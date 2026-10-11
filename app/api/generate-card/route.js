import { NextResponse } from 'next/server';
import { BASE_SYSTEM_PROMPT, THEME_PROMPTS, buildGroupContextInstruction } from '@/app/lib/aiPrompts';
import { drawBuiltInCard, normalizeIntensityKey, SPECIAL_ROUND_TYPES } from '@/app/lib/fallbackDeck';

// Simple per-IP in-memory rate limiter (35 requests per minute)
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 35;
const rateLimitMap = new Map();

function checkRateLimit(ip) {
  const now = Date.now();
  const key = ip || 'local';
  const entry = rateLimitMap.get(key);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(key, { windowStart: now, count: 1 });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }
  entry.count += 1;
  return true;
}

/**
 * Safely parses AI output into a JSON object, stripping any accidental
 * reasoning tags (<think>...</think>) or markdown code fences (```json ... ```).
 */
function safeParseJson(raw) {
  if (!raw || typeof raw !== 'string') {
    throw new Error('Empty or non-string AI response');
  }

  const cleaned = raw
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/```(?:json)?/gi, '')
    .replace(/```/g, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
    }
    throw new Error('Failed to parse valid JSON from AI response');
  }
}

async function callOpenRouter(model, promptText) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set');

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://between-game.local',
      'X-Title': 'BETWEEN Game'
    },
    body: JSON.stringify({
      model: model || 'openrouter/free',
      messages: [
        { role: 'system', content: promptText.system },
        { role: 'user', content: promptText.user }
      ],
      temperature: 0.9
    }),
    signal: AbortSignal.timeout(10000)
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenRouter Error [${res.status}]: ${errText}`);
  }

  const data = await res.json();
  const msg = data.choices?.[0]?.message;
  const rawContent = msg?.content || msg?.reasoning;
  if (!rawContent) throw new Error('OpenRouter returned empty content');
  return safeParseJson(rawContent);
}

const GEMINI_FALLBACK_MODELS = {
  'gemini-2.5-flash': 'gemini-3.8-flash',
  'gemini-2.5-pro': 'gemini-3.1-pro-preview',
  'gemini-2.5-flash-lite': 'gemini-3.5-flash-lite'
};

async function fetchGeminiModel(modelId, apiKey, promptText) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: `${promptText.system}\n\nTask:\n${promptText.user}` }]
        }
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.9
      }
    }),
    signal: AbortSignal.timeout(10000)
  });
}

async function callGemini(modelName, promptText) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');

  const cleanModel = (modelName || 'gemini-2.5-flash').replace(/^google\//, '');
  let res = await fetchGeminiModel(cleanModel, apiKey, promptText);

  if (res.status === 404) {
    const upgradedModel = GEMINI_FALLBACK_MODELS[cleanModel] || 'gemini-3.8-flash';
    res = await fetchGeminiModel(upgradedModel, apiKey, promptText);
    if (res.status === 404 && upgradedModel !== 'gemini-3.8-flash') {
      res = await fetchGeminiModel('gemini-3.8-flash', apiKey, promptText);
    }
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini Error [${res.status}]: ${errText}`);
  }

  const data = await res.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) throw new Error('Gemini returned empty content');
  return safeParseJson(rawText);
}

export async function POST(req) {
  try {
    const forwarded = req.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0].trim() : 'local';
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please wait a moment and try again.' },
        { status: 429 }
      );
    }

    const rawBody = await req.text();
    if (rawBody.length > 32_768) {
      return NextResponse.json(
        { success: false, error: 'Request payload too large.' },
        { status: 413 }
      );
    }

    const body = rawBody ? JSON.parse(rawBody) : {};
    const {
      type,
      theme,
      mode,
      selectedModel,
      players = [],
      currentPlayer = null,
      targetPlayer = null,
      roundType = 'standard',
      excludePrompts = [],
      allowFallback = true
    } = body;

    const normalizedType = typeof type === 'string' ? type.toLowerCase().trim() : '';
    const normalizedMode = typeof mode === 'string' ? mode.toLowerCase().trim() : '';

    if (!normalizedType || !['truth', 'dare'].includes(normalizedType)) {
      return NextResponse.json({ success: false, error: 'Invalid type' }, { status: 400 });
    }
    if (!normalizedMode || !['online', 'offline'].includes(normalizedMode)) {
      return NextResponse.json({ success: false, error: 'Invalid mode' }, { status: 400 });
    }

    const selectedThemeKey = normalizeIntensityKey(theme || 'playful');
    const themeInstruction = THEME_PROMPTS[selectedThemeKey] || THEME_PROMPTS.playful;
    const contextInstruction = buildGroupContextInstruction({
      mode: normalizedMode,
      type: normalizedType,
      players: Array.isArray(players) ? players.slice(0, 12) : [],
      currentPlayer,
      targetPlayer,
      roundType,
      excludePrompts: Array.isArray(excludePrompts) ? excludePrompts.slice(-10) : []
    });

    const systemPrompt = `${BASE_SYSTEM_PROMPT}\n\n${themeInstruction}${contextInstruction}`;
    const userPrompt = `Generate one ${normalizedType.toUpperCase()} prompt for "${selectedThemeKey.toUpperCase()}" theme in "${normalizedMode.toUpperCase()}" mode${
      roundType && roundType !== 'standard' ? ` (${roundType.toUpperCase()} special round)` : ''
    }. Output raw JSON only.`;

    const promptPayload = { system: systemPrompt, user: userPrompt };

    let cardData = null;
    let providerUsed = '';
    let usedBuiltInFallback = false;

    const isGeminiDirect = selectedModel?.startsWith('google/');

    try {
      if (isGeminiDirect) {
        try {
          cardData = await callGemini(selectedModel, promptPayload);
          providerUsed = selectedModel;
        } catch (err) {
          console.warn('Gemini direct call failed, falling back to OpenRouter:', err.message);
          cardData = await callOpenRouter('openrouter/free', promptPayload);
          providerUsed = 'openrouter/free (fallback)';
        }
      } else {
        try {
          cardData = await callOpenRouter(selectedModel || 'openrouter/free', promptPayload);
          providerUsed = selectedModel || 'openrouter/free';
        } catch (openRouterErr) {
          console.warn('OpenRouter failed, activating Gemini fallback:', openRouterErr.message);
          cardData = await callGemini('gemini-2.5-flash', promptPayload);
          providerUsed = 'gemini-2.5-flash (fallback)';
        }
      }

      if (!cardData?.prompt || typeof cardData.prompt !== 'string') {
        throw new Error('AI returned invalid card structure');
      }
    } catch (aiError) {
      if (!allowFallback) {
        throw aiError;
      }
      console.warn('All AI providers failed; using built-in deck fallback:', aiError.message);
      const fallbackCard = drawBuiltInCard({
        type: normalizedType,
        theme: selectedThemeKey,
        mode: normalizedMode,
        players: Array.isArray(players) ? players : [],
        currentPlayer,
        targetPlayer,
        roundType,
        excludePrompts: Array.isArray(excludePrompts) ? excludePrompts : []
      });
      cardData = {
        type: fallbackCard.type,
        theme: fallbackCard.theme,
        mode: fallbackCard.mode,
        prompt: fallbackCard.prompt,
        targetPlayerName: fallbackCard.targetPlayerName || null
      };
      providerUsed = 'built-in-deck (fallback)';
      usedBuiltInFallback = true;
    }

    const roundInfo = SPECIAL_ROUND_TYPES[roundType] || SPECIAL_ROUND_TYPES.standard;
    const cleanPrompt = cardData.prompt.trim();
    const finalType = ['truth', 'dare'].includes(String(cardData.type || '').toLowerCase())
      ? String(cardData.type).toLowerCase()
      : normalizedType;
    const finalTheme = cardData.theme ? normalizeIntensityKey(cardData.theme) : selectedThemeKey;
    const finalMode = ['online', 'offline'].includes(String(cardData.mode || '').toLowerCase())
      ? String(cardData.mode).toLowerCase()
      : normalizedMode;

    const targetName =
      cardData.targetPlayerName ||
      (typeof targetPlayer === 'string'
        ? targetPlayer
        : targetPlayer?.name || null);

    const validatedCard = {
      id: `${usedBuiltInFallback ? 'fallback' : 'ai'}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: finalType,
      kind: finalType,
      theme: finalTheme,
      intensity: finalTheme,
      mode: finalMode,
      prompt: cleanPrompt,
      body: cleanPrompt,
      category:
        roundInfo.id !== 'standard'
          ? roundInfo.label
          : usedBuiltInFallback
          ? 'Built-in Fallback'
          : 'AI Generated',
      targetPlayerName: targetName,
      roundType: roundInfo.id,
      roundLabel: roundInfo.label,
      bonusPoints: roundInfo.bonusPoints || 0,
      source: usedBuiltInFallback ? 'fallback' : 'ai',
      provider: providerUsed
    };

    return NextResponse.json({
      success: true,
      card: validatedCard,
      provider: providerUsed,
      fallback: usedBuiltInFallback
    });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
