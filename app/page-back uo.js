"use client";



import { useEffect, useState } from "react";

import { createClient } from "@supabase/supabase-js";



const supabase = createClient(

  process.env.NEXT_PUBLIC_SUPABASE_URL,

  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

);



const MODES = [

  ["01", "PLAYFUL", "Easy beginnings"],

  ["02", "PERSONAL", "Get to know each other"],

  ["03", "FLIRTY", "A little closer"],

  ["04", "WILD", "No backing out"],

  ["05", "AFTER DARK", "18+ only"],

];



function makeRoomCode() {

  return Math.random().toString(36).substring(2, 8).toUpperCase();

}



export default function Home() {

  const [screen, setScreen] = useState("home");

  const [mode, setMode] = useState("PLAYFUL");

  const [showAgeGate, setShowAgeGate] = useState(false);

const [ageVerified, setAgeVerified] = useState(false);

  const [name, setName] = useState("");

  const [room, setRoom] = useState("");



  useEffect(() => {

    const params = new URLSearchParams(window.location.search);



    const invitedRoom = params.get("room");

    const isGame = params.get("game") === "true";



    if (invitedRoom) {

      const code = invitedRoom.toUpperCase();



      setRoom(code);



      if (isGame) {

        setScreen("game");

      } else {

        setScreen("join");

      }

    }

  }, []);



  async function createRoom() {

    if (!name.trim()) return;



    const code = makeRoomCode();



    const { error } = await supabase.from("rooms").insert({

      code,

      host_name: name.trim(),

      intensity: mode,

      status: "waiting",

    });



    if (error) {

      alert(error.message);

      return;

    }



    localStorage.setItem(

      "between_player",

      JSON.stringify({

        room: code,

        role: "host",

        nickname: name.trim(),

      })

    );



    setRoom(code);



    window.history.replaceState(

      {},

      "",

      `/?room=${code}`

    );



    setScreen("lobby");

  }



  async function joinRoom() {

    if (!name.trim() || !room.trim()) return;



    const code = room.trim().toUpperCase();



    const { data, error } = await supabase

      .from("rooms")

      .select("*")

      .eq("code", code)

      .maybeSingle();



    if (error) {

      alert(error.message);

      return;

    }



    if (!data) {

      alert("Room not found.");

      return;

    }



    if (data.guest_name) {

      alert("This room already has two players.");

      return;

    }



    const { error: updateError } = await supabase

      .from("rooms")

      .update({

        guest_name: name.trim(),

        status: "ready",

      })

      .eq("id", data.id);



    if (updateError) {

      alert(updateError.message);

      return;

    }



    localStorage.setItem(

      "between_player",

      JSON.stringify({

        room: code,

        role: "guest",

        nickname: name.trim(),

      })

    );



    setRoom(code);

    setMode(data.intensity);



    window.history.replaceState(

      {},

      "",

      `/?room=${code}`

    );



    setScreen("lobby");

  }



  return (

    <>

      <div className="grain" />



      {screen === "home" && (

        <HomeScreen

          mode={mode}

          setMode={setMode}

          onCreate={() => setScreen("create")}

          onJoin={() => setScreen("join")}

        />

      )}



      {screen === "create" && (

        <FormScreen

          title="Create a room."

          button="CREATE ROOM"

          name={name}

          setName={setName}

          onBack={() => setScreen("home")}

          onSubmit={createRoom}

          extra={

            <div>

              <label>Intensity</label>



              <select

                value={mode}

                onChange={(e) => setMode(e.target.value)}

                className="mode-select"

              >

                {MODES.map((item) => (

                  <option key={item[1]} value={item[1]}>

                    {item[1]}

                  </option>

                ))}

              </select>

            </div>

          }

        />

      )}



      {screen === "join" && (

        <FormScreen

          title="Join them."

          button="JOIN ROOM"

          name={name}

          setName={setName}

          room={room}

          setRoom={setRoom}

          onBack={() => setScreen("home")}

          onSubmit={joinRoom}

          join

        />

      )}



      {screen === "lobby" && (

        <Lobby

          room={room}

          onGame={() => setScreen("game")}

        />

      )}



      {screen === "game" && (

        <Game roomCode={room} />

      )}

    </>

  );

}





/* =========================

   HOME

\========================= */

function HomeScreen({

  mode,

  setMode,

  onCreate,

  onJoin,

}) {

  const [showAgeGate, setShowAgeGate] = useState(false);

  const [ageVerified, setAgeVerified] = useState(false);



  function selectMode(title) {

    if (title === "AFTER DARK" && !ageVerified) {

      setShowAgeGate(true);

      return;

    }



    setMode(title);

  }



  return (

    <>

      <main className="home">



        <nav className="nav">

          <div className="wordmark">

            BETWEEN

          </div>



          <div className="nav-note">

            A GAME FOR TWO

          </div>

        </nav>



        <section className="hero">



          <p className="eyebrow">

            TWO PEOPLE · ONE PRIVATE SPACE

          </p>



          <h1>

            What happens

            <br />

            <em>between</em> you.

          </h1>



          <p className="sub">

            Truths. Dares. Questions you wouldn't normally ask.

            A private game designed for two people.

          </p>



          <div className="actions">



            <button

              className="primary"

              onClick={onCreate}

            >

              CREATE ROOM

              <span>→</span>

            </button>



            <button

              className="secondary"

              onClick={onJoin}

            >

              JOIN ROOM

            </button>



          </div>



          <p className="private-line">

            <span>●</span>

            PRIVATE · TWO PLAYERS

          </p>



        </section>



        <section className="intensity">



          <p className="section-label">

            CHOOSE YOUR ENERGY

          </p>



          <div className="moods">



            {MODES.map(([num, title, description]) => (

              <button

                key={title}

                className={`mood ${

                  mode === title ? "selected" : ""

                }`}

                onClick={() => selectMode(title)}

              >



                <span className="mood-num">

                  {num}

                </span>



                <strong>

                  {title}

                </strong>



                <small>

                  {description}

                </small>



              </button>

            ))}



          </div>



        </section>



        <footer>

          <span>BETWEEN</span>

          <span>KEEP IT BETWEEN YOU.</span>

        </footer>



      </main>



      {showAgeGate && (

        <div className="age-overlay">



          <div className="age-card">



            <p className="eyebrow">

              BETWEEN · AFTER DARK

            </p>



            <h2>

              Are you

              <br />

              <em>18 or older?</em>

            </h2>



            <p>

              AFTER DARK is intended only for adults.

              By continuing, you confirm that you are

              at least 18 years old.

            </p>



            <div className="age-actions">



              <button

                className="primary"

                onClick={() => {

                  setAgeVerified(true);

                  setMode("AFTER DARK");

                  setShowAgeGate(false);

                }}

              >

                I'M 18+ · CONTINUE

              </button>



              <button

                className="secondary"

                onClick={() => {

                  setShowAgeGate(false);

                }}

              >

                GO BACK

              </button>



            </div>



          </div>



        </div>

      )}



    </>

  );

}





/* =========================

   FORM

\========================= */



function FormScreen({

  title,

  button,

  name,

  setName,

  room,

  setRoom,

  onBack,

  onSubmit,

  join,

  extra,

}) {

  return (

    <main className="form-page">



      <button

        className="back"

        onClick={onBack}

      >

        ← BACK

      </button>



      <div className="form-card">



        <p className="eyebrow">

          BETWEEN

        </p>



        <h1>{title}</h1>



        <label>Your name</label>



        <input

          value={name}

          onChange={(e) => setName(e.target.value)}

          placeholder="What should they call you?"

          maxLength={30}

        />



        {join && (

          <>

            <label>Room code</label>



            <input

              value={room}

              onChange={(e) =>

                setRoom(e.target.value.toUpperCase())

              }

              placeholder="ABC123"

              maxLength={6}

            />

          </>

        )}



        {extra}



        <button

          className="primary full"

          disabled={!name.trim() || (join && !room.trim())}

          onClick={onSubmit}

        >

          {button}

        </button>



        <span className="privacy">

          Your room is private and designed for two people.

        </span>



      </div>



    </main>

  );

}





/* =========================

   LOBBY

\========================= */



function Lobby({ room, onGame }) {

  const [roomData, setRoomData] = useState(null);

  const [copied, setCopied] = useState(false);



  useEffect(() => {

    let channel;



    async function loadRoom() {

      const { data } = await supabase

        .from("rooms")

        .select("*")

        .eq("code", room)

        .maybeSingle();



      setRoomData(data);

    }



    loadRoom();



    channel = supabase

      .channel(`lobby-${room}`)

      .on(

        "postgres_changes",

        {

          event: "UPDATE",

          schema: "public",

          table: "rooms",

        },

        (payload) => {

          if (payload.new.code === room) {

            setRoomData(payload.new);



            if (payload.new.status === "playing") {

              window.location.href =

                `/?room=${room}&game=true`;

            }

          }

        }

      )

      .subscribe();



    return () => {

      supabase.removeChannel(channel);

    };

  }, [room]);



  async function startGame() {

    if (!roomData?.guest_name) return;



    const { error } = await supabase

      .from("rooms")

      .update({

        status: "playing",

      })

      .eq("id", roomData.id);



    if (error) {

      alert(error.message);

      return;

    }



    window.location.href =

      `/?room=${room}&game=true`;

  }



  async function copyInvite() {

    const link =

      `${window.location.origin}/?room=${room}`;



    await navigator.clipboard.writeText(link);



    setCopied(true);



    setTimeout(() => {

      setCopied(false);

    }, 2000);

  }



  if (!roomData) {

    return (

      <main className="lobby">

        <div className="lobby-center">

          <p className="eyebrow">

            LOADING ROOM

          </p>

        </div>

      </main>

    );

  }



  return (

    <main className="lobby">



      <div className="lobby-top">



        <div className="wordmark">

          BETWEEN

        </div>



        <div>

          ROOM <b>{room}</b>

        </div>



      </div>



      <div className="lobby-center">



        <p className="eyebrow">

          ROOM READY

        </p>



        <h1>

          Waiting for

          <br />

          <em>two.</em>

        </h1>



        <div className="players">



          <div>

            <i />

            {roomData.host_name}

          </div>



          <div>

            <i

              className={

                roomData.guest_name

                  ? ""

                  : "waiting"

              }

            />



            {roomData.guest_name ||

              "WAITING..."}

          </div>



        </div>



        <p className="share">

          SHARE ROOM CODE

          <strong>{room}</strong>

        </p>



        <div className="actions">



          <button

            className="secondary"

            onClick={copyInvite}

          >

            {copied

              ? "COPIED"

              : "COPY INVITE LINK"}

          </button>



          {roomData.guest_name && (

            <button

              className="primary"

              onClick={startGame}

            >

              START BETWEEN

              <span>→</span>

            </button>

          )}



        </div>



        <p className="mode">

          {roomData.intensity} · TWO PLAYERS

        </p>



      </div>



    </main>

  );

}





/* =========================

   REAL GAME

\========================= */



function Game({ roomCode }) {



  const [roomData, setRoomData] = useState(null);

  const [question, setQuestion] = useState(null);

  const [messages, setMessages] = useState([]);



  const [player, setPlayer] = useState(null);



  const [chatText, setChatText] = useState("");

  const [loading, setLoading] = useState(true);



  useEffect(() => {



    const stored =

      localStorage.getItem("between_player");



    if (stored) {

      try {

        setPlayer(JSON.parse(stored));

      } catch {

        console.log("Could not read player data.");

      }

    }



  }, []);





  useEffect(() => {



    if (!roomCode) return;



    let roomChannel;

    let messageChannel;



    async function loadGame() {



      const { data: room, error } =

        await supabase

          .from("rooms")

          .select("*")

          .eq("code", roomCode)

          .maybeSingle();



      if (error || !room) {

        alert("Room could not be found.");

        return;

      }



      setRoomData(room);



      if (room.current_question_id) {

        await loadQuestion(

          room.current_question_id

        );

      }



      const { data: oldMessages } =

        await supabase

          .from("messages")

          .select("*")

          .eq("room_id", room.id)

          .order("created_at", {

            ascending: true,

          });



      setMessages(oldMessages || []);



      setLoading(false);





     /* ROOM REALTIME */



roomChannel = supabase

  .channel(`game-room-${roomCode}-${Date.now()}`)

  .on(

    "postgres_changes",

    {

      event: "UPDATE",

      schema: "public",

      table: "rooms",

    },

    async (payload) => {

      if (payload.new.code !== roomCode) {

        return;

      }



      setRoomData(payload.new);



      if (payload.new.current_question_id) {

        await loadQuestion(

          payload.new.current_question_id

        );

      } else {

        setQuestion(null);

      }

    }

  );



roomChannel.subscribe();



    /* CHAT REALTIME */



messageChannel = supabase

  .channel(`game-chat-${room.id}-${Date.now()}`)

  .on(

    "postgres_changes",

    {

      event: "INSERT",

      schema: "public",

      table: "messages",

      filter: `room_id=eq.${room.id}`,

    },

    (payload) => {

      setMessages((current) => {

        const exists = current.some(

          (message) =>

            message.id === payload.new.id

        );



        if (exists) {

          return current;

        }



        return [

          ...current,

          payload.new,

        ];

      });

    }

  );



messageChannel.subscribe();



    }



    async function loadQuestion(id) {



      const { data } =

        await supabase

          .from("questions")

          .select("*")

          .eq("id", id)

          .maybeSingle();



      if (data) {

        setQuestion(data);

      }



    }



    loadGame();



    return () => {



      if (roomChannel) {

        supabase.removeChannel(roomChannel);

      }



      if (messageChannel) {

        supabase.removeChannel(messageChannel);

      }



    };



  }, [roomCode]);





  async function chooseQuestion(kind) {



    if (!roomData || !player) return;



    const myPlayerNumber =

      player.role === "host" ? 1 : 2;



    if (

      roomData.current_player !==

      myPlayerNumber

    ) {

      return;

    }



    const { data, error } =

      await supabase

        .from("questions")

        .select("*")

        .eq("intensity", roomData.intensity)

        .eq("kind", kind)

        .eq("active", true);



    if (error) {

      alert(error.message);

      return;

    }



    if (!data || data.length === 0) {

      alert(

        `No ${kind.toLowerCase()} questions are available for ${roomData.intensity} yet.`

      );

      return;

    }



    const randomQuestion =

      data[Math.floor(Math.random() * data.length)];



    const { error: updateError } =

      await supabase

        .from("rooms")

        .update({

          current_question_id:

            randomQuestion.id,

        })

        .eq("id", roomData.id);



    if (updateError) {

      alert(updateError.message);

    }



  }





  async function nextTurn() {
    if (!roomData || !player) {
      return;
    }

    const myPlayerNumber =
      player.role === "host" ? 1 : 2;

    if (roomData.current_player !== myPlayerNumber) {
      return;
    }

    await supabase
      .from("rooms")
      .update({
        current_player: myPlayerNumber === 1 ? 2 : 1,
        current_question_id: null,
      })
      .eq("id", roomData.id);
  }

  async function skipQuestion() {
    if (!question || !roomData || !player) {
      return;
    }

    const myPlayerNumber =
      player.role === "host" ? 1 : 2;

    if (roomData.current_player !== myPlayerNumber) {
      return;
    }

    await supabase
      .from("messages")
      .insert({
        room_id: roomData.id,
        player: myPlayerNumber,
        nickname: player.nickname,
        body: `${player.nickname} skipped the previous question.`,
      });

    await chooseQuestion(question.kind);
  }

 !chatText.trim() ||

      !roomData ||

      !player

    ) {

      return;

    }



    const myPlayerNumber =

      player.role === "host" ? 1 : 2;



    const text = chatText.trim();



    setChatText("");



    const { error } =

      await supabase

        .from("messages")

        .insert({

          room_id: roomData.id,

          player: myPlayerNumber,

          nickname: player.nickname,

          body: text,

        });



    if (error) {

      alert(error.message);

      setChatText(text);

    }



  }





  if (loading || !roomData) {



    return (

      <main className="game-page">

        <div className="game-loading">

          <p className="eyebrow">

            BETWEEN

          </p>

          <h1>

            Entering your

            <br />

            <em>space.</em>

          </h1>

        </div>

      </main>

    );



  }





  const myPlayerNumber =

    player?.role === "host" ? 1 : 2;



  const isMyTurn =

    roomData.current_player ===

    myPlayerNumber;



  const otherPlayer =

    myPlayerNumber === 1

      ? roomData.guest_name

      : roomData.host_name;





  return (

    <main className="game-page">



      <div className="game-top">



        <div className="wordmark">

          BETWEEN

        </div>



        <div className="game-room">

          {roomData.intensity}

          <span>·</span>

          ROOM {roomCode}

        </div>



      </div>





      <div className="game-layout">



        {/* GAME */}



        <section className="game-main">



         <div

  className="turn-label turn-reveal"

  key={`${roomData.current_player}-${roomData.current_question_id || "choice"}`}

>

  {isMyTurn

    ? "YOUR TURN"

    : `${otherPlayer?.toUpperCase() || "THEM"}'S TURN`}

</div>





          {!question && isMyTurn && (



            <div className="choice-card">



              <p className="eyebrow">

                CHOOSE YOUR MOVE

              </p>



              <h1>

                Truth or

                <br />

                <em>dare?</em>

              </h1>



              <div className="actions">



                <button

                  className="primary"

                  onClick={() =>

                    chooseQuestion("TRUTH")

                  }

                >

                  TRUTH

                </button>



                <button

                  className="secondary"

                  onClick={() =>

                    chooseQuestion("DARE")

                  }

                >

                  DARE

                </button>



              </div>



            </div>



          )}





          {!question && !isMyTurn && (



            <div className="choice-card">



              <p className="eyebrow">

                THEIR MOVE

              </p>



              <h1>

                Your turn

                <br />

                <em>comes next.</em>

              </h1>



              <p className="waiting-text">

                {otherPlayer || "The other player"} is

                choosing a truth or dare.

              </p>



            </div>



          )}





          {question && (



            <div

  className="question-card question-reveal"

  key={question.id}

>



              <div className="question-kind">

                {question.kind}

              </div>



              <p className="question-text">

                {question.body}

              </p>



              {isMyTurn && (



                <div className="question-actions">



                  <button

                    className="secondary"

                    onClick={skipQuestion}

                  >

                    SKIP

                  </button>



                  <button

                    className="primary"

                    onClick={nextTurn}

                  >

                    DONE · NEXT TURN →

                  </button>



                </div>



              )}



              {!isMyTurn && (



                <p className="waiting-text">

                  Waiting for {otherPlayer || "them"}...

                </p>



              )}



            </div>



          )}



        </section>





        {/* CHAT */}



<aside className="chat">

          <div className="messages">



            {messages.length === 0 && (



              <div className="empty-chat">

                Say something.

              </div>



            )}







     {messages.map((message) => {

  const isSystemMessage = message.body

    .toLowerCase()

    .includes("skipped the previous question");



  const mine = message.player === myPlayerNumber;



  if (isSystemMessage) {

    return (

      <div

        key={message.id}

        className="system-message"

      >

        <span>{message.body}</span>

      </div>

    );

  }



  return (

    <div

      key={message.id}

      className={`message ${mine ? "mine" : ""}`}

    >

      <span className="message-name">

        {mine ? "YOU" : message.nickname}

      </span>



      <div className="message-body">

        {message.body}

      </div>

    </div>

  );

})}



</div>



          <form

            className="chat-form"

            onSubmit={sendMessage}

          >



            <input

              value={chatText}

              onChange={(e) =>

                setChatText(e.target.value)

              }

              placeholder="Say something..."

              maxLength={500}

            />



            <button type="submit">

              →

            </button>



          </form>



        </aside>



      </div>



    </main>

  );

}