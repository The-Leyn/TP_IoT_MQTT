<script>
  import { onMount } from "svelte";

  // --- CONFIGURATION ---
  const MAPPING_SALLES = {
    "esp32-01": "Accueil",
    "esp32-02": "Salle de cours 1",
    "esp32-03": "Salle de cours 2",
    "esp32-04": "Cafétéria",
    "esp32-05": "Labo IoT",
    "esp32-06": "Bureau Admin",
  };

  // --- ÉTAT GLOBAL ---
  let status = $state("idle");
  let now = $state(Date.now());

  let activeTab = $state("weather");

  // --- ÉTAT MÉTÉO ---
  let devices = $state({});
  let searchTerm = $state(""); // Pour le filtre

  // --- ÉTAT FLIPPER ---
  let flipperEvents = $state([]);
  let buttonStats = $state({
    leftFlipper: 0,
    rightFlipper: 0,
    start: 0,
    coin: 0,
    tilt: 0,
  });

  // --- LOGIQUE MÉTÉO (Filtres & Moyennes) ---
  let filteredList = $derived(
    Object.entries(devices).filter(([id, info]) => {
      const name = (MAPPING_SALLES[id] || id).toLowerCase();
      const search = searchTerm.toLowerCase();
      return name.includes(search) || id.includes(search);
    }),
  );

  let averages = $derived.by(() => {
    const values = Object.values(devices);
    if (values.length === 0) return null;
    const totalTemp = values.reduce((sum, d) => sum + (d.tempC || 0), 0);
    const totalHum = values.reduce((sum, d) => sum + (d.humPct || 0), 0);
    return {
      temp: (totalTemp / values.length).toFixed(1),
      hum: (totalHum / values.length).toFixed(0),
    };
  });

  // --- LOGIQUE FLIPPER ---

  let currentInput = $state({
    leftFlipper: false,
    rightFlipper: false,
    start: false,
    coin: false,
    tilt: false,
  });

  function handleFlipperMessage(msg) {
    const newEvent = {
      id: crypto.randomUUID(),
      time: new Date().toLocaleTimeString(),
      device: msg.deviceId,
      type: msg.subType,
      details: "",
    };

    if (msg.subType === "buttons") {
      const btns = msg.data.buttons;
      const activeButtons = Object.keys(btns).filter((k) => btns[k] === true);
      currentInput = { ...btns, tilt: false };
      if (activeButtons.length > 0) {
        newEvent.details = "Bouton: " + activeButtons.join(", ");
        activeButtons.forEach((btn) => {
          if (buttonStats[btn] !== undefined) buttonStats[btn]++;
        });
      } else return;
    } else if (msg.subType === "tilt") {
      if (msg.data.tilt) {
        currentInput.tilt = true;
        newEvent.details = "⚠️ TILT DÉTECTÉ !";
        buttonStats.tilt++;
        setTimeout(() => {
          currentInput.tilt = false;
        }, 500);
      } else return;
    } else if (msg.subType === "plunger") {
      newEvent.details = `Lanceur: ${msg.data.action}`;
    }

    flipperEvents = [newEvent, ...flipperEvents].slice(0, 20);
  }

  // --- CONNEXION ---
  function connect() {
    status = "connecting";
    const ws = new WebSocket("ws://localhost:8080");

    ws.onopen = () => {
      status = "connected";
      console.log("WS Connected");
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.category === "classroom") {
          if (msg.deviceId) {
            devices[msg.deviceId] = { ...msg.data, lastSeen: msg.timestamp };
          }
        } else if (msg.category === "flipper") {
          handleFlipperMessage(msg);
        }
      } catch (e) {
        console.error("Erreur parsing", e);
      }
    };

    ws.onclose = () => (status = "disconnected");
    ws.onerror = () => (status = "error");
  }

  onMount(() => {
    connect();
    const interval = setInterval(() => {
      now = Date.now();
    }, 1000);
    return () => clearInterval(interval);
  });

  function getPlaceName(id) {
    return MAPPING_SALLES[id] || id;
  }
  function isOffline(lastSeen) {
    return now - lastSeen > 15000;
  }
</script>

<div class="min-h-screen bg-slate-50 p-6 md:p-12 font-sans text-slate-800">
  <header
    class="flex flex-col md:flex-row justify-between items-center mb-6 gap-4"
  >
    <div>
      <h1 class="text-3xl font-extrabold tracking-tight text-slate-900">
        Dashboard IoT
      </h1>
      <p class="text-slate-500">Supervision HETIC & Pinball</p>
    </div>

    <div
      class="flex items-center gap-3 bg-white p-2 rounded-lg shadow-sm border border-slate-200"
    >
      <div class="flex items-center gap-2 px-3">
        <span class="relative flex h-3 w-3">
          <span
            class="animate-ping absolute inline-flex h-full w-full rounded-full {status ===
            'connected'
              ? 'bg-green-400'
              : 'bg-red-400'} opacity-75"
          ></span>
          <span
            class="relative inline-flex rounded-full h-3 w-3 {status ===
            'connected'
              ? 'bg-green-500'
              : 'bg-red-500'}"
          ></span>
        </span>
        <span
          class="text-sm font-bold uppercase {status === 'connected'
            ? 'text-green-700'
            : 'text-red-600'}"
        >
          {status}
        </span>
      </div>
      {#if status !== "connected"}
        <button
          onclick={connect}
          class="text-sm bg-slate-200 hover:bg-slate-300 px-3 py-1 rounded transition"
          >Reconnecter</button
        >
      {/if}
    </div>
  </header>

  <div class="flex gap-1 bg-slate-200 p-1 rounded-xl w-fit mb-8">
    <button
      onclick={() => (activeTab = "weather")}
      class="cursor-pointer px-6 py-2 rounded-lg font-bold transition-all text-sm {activeTab ===
      'weather'
        ? 'bg-white text-blue-600 shadow-sm'
        : 'text-slate-500 hover:text-slate-700'}"
    >
      ☁️ Météo Salles
    </button>
    <button
      onclick={() => (activeTab = "flipper")}
      class="cursor-pointer px-6 py-2 rounded-lg font-bold transition-all text-sm {activeTab ===
      'flipper'
        ? 'bg-white text-purple-600 shadow-sm'
        : 'text-slate-500 hover:text-slate-700'}"
    >
      🎰 Flipper Live
    </button>
  </div>

  {#if activeTab === "weather"}
    <div class="animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div
        class="mb-8 flex flex-col md:flex-row gap-6 justify-between items-end"
      >
        <div class="w-full md:w-1/3">
          <label
            class="block text-sm font-bold text-slate-500 mb-1"
            for="search">Rechercher</label
          >
          <input
            type="text"
            id="search"
            placeholder="Ex: Cafétéria..."
            bind:value={searchTerm}
            class="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
        </div>
        {#if averages}
          <div
            class="flex gap-4 bg-slate-800 text-white p-3 rounded-lg shadow-lg"
          >
            <div class="px-2 border-r border-slate-600">
              <div class="text-xs text-slate-400 uppercase">Moy. Temp</div>
              <div class="text-xl font-bold">{averages.temp}°C</div>
            </div>
            <div class="px-2">
              <div class="text-xs text-slate-400 uppercase">Moy. Hum</div>
              <div class="text-xl font-bold">{averages.hum}%</div>
            </div>
          </div>
        {/if}
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {#each filteredList as [id, info] (id)}
          {@const offline = isOffline(info.lastSeen)}
          <div
            class="relative bg-white rounded-2xl p-6 shadow-sm border border-slate-100 transition hover:shadow-lg hover:-translate-y-1"
          >
            <div
              class="absolute left-0 top-4 bottom-4 w-1.5 rounded-r {offline
                ? 'bg-red-300'
                : 'bg-green-500'}"
            ></div>
            <div class="flex justify-between items-start mb-6 pl-4">
              <div>
                <h2 class="text-xl font-bold truncate">{getPlaceName(id)}</h2>
                <code
                  class="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded"
                  >{id}</code
                >
              </div>
              {#if info.batteryPct !== undefined}
                <div class="flex items-center gap-1">
                  <span
                    class="text-xs font-bold {info.batteryPct < 20
                      ? 'text-red-500'
                      : 'text-slate-400'}">{info.batteryPct}%</span
                  >
                  <div
                    class="w-6 h-3 border border-slate-300 rounded overflow-hidden p-0.5 bg-slate-50"
                  >
                    <div
                      class="h-full rounded-sm {info.batteryPct < 20
                        ? 'bg-red-500'
                        : 'bg-green-500'}"
                      style="width: {info.batteryPct}%"
                    ></div>
                  </div>
                </div>
              {/if}
            </div>
            <div class="grid grid-cols-2 gap-4 mb-4 pl-4">
              <div class="bg-blue-50 rounded-xl p-3">
                <span class="text-xs uppercase text-blue-400 font-bold"
                  >Temp</span
                >
                <div class="text-3xl font-bold text-blue-700 mt-1">
                  {info.tempC ? info.tempC.toFixed(1) : "--"}°
                </div>
              </div>
              <div class="bg-indigo-50 rounded-xl p-3">
                <span class="text-xs uppercase text-indigo-400 font-bold"
                  >Humidité</span
                >
                <div class="text-3xl font-bold text-indigo-700 mt-1">
                  {info.humPct ? info.humPct.toFixed(0) : "--"}%
                </div>
              </div>
            </div>
            <div
              class="flex justify-between items-center text-xs text-slate-400 pt-4 border-t border-slate-50 pl-4"
            >
              <span>Maj: {new Date(info.lastSeen).toLocaleTimeString()}</span>
              {#if offline}
                <span
                  class="bg-red-100 text-red-600 px-2 py-1 rounded font-bold animate-pulse"
                  >OFFLINE</span
                >
              {/if}
            </div>
          </div>
        {/each}
      </div>

      {#if filteredList.length === 0 && status === "connected"}
        <div class="text-center mt-20 text-slate-400">
          Aucune donnée météo pour le moment...
        </div>
      {/if}
    </div>
  {/if}

  {#if activeTab === "flipper"}
    <div class="animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-4">
        <div
          class="lg:col-span-1 bg-slate-900 text-white p-6 rounded-2xl shadow-xl h-fit"
        >
          <h3 class="text-xl font-bold mb-6 text-purple-400">Scoreboard</h3>
          <div class="grid grid-cols-2 gap-4">
            <div
              class="bg-slate-800 p-4 rounded-xl text-center border-l-4 border-yellow-400"
            >
              <div class="text-2xl font-bold">{buttonStats.leftFlipper}</div>
              <div class="text-xs text-slate-400 uppercase mt-1">Left Flip</div>
            </div>
            <div
              class="bg-slate-800 p-4 rounded-xl text-center border-r-4 border-yellow-400"
            >
              <div class="text-2xl font-bold">{buttonStats.rightFlipper}</div>
              <div class="text-xs text-slate-400 uppercase mt-1">
                Right Flip
              </div>
            </div>
            <div
              class="col-span-2 bg-slate-800 p-4 rounded-xl flex justify-between items-center"
            >
              <span class="text-slate-400 uppercase text-xs font-bold"
                >Start Button</span
              >
              <span class="text-xl font-mono text-green-400"
                >{buttonStats.start}</span
              >
            </div>
            <div
              class="col-span-2 bg-slate-800 p-4 rounded-xl flex justify-between items-center"
            >
              <span class="text-slate-400 uppercase text-xs font-bold"
                >Coins Inserted</span
              >
              <span class="text-xl font-mono text-yellow-400"
                >{buttonStats.coin}</span
              >
            </div>
            <div
              class="col-span-2 bg-red-900/30 border border-red-500/50 p-4 rounded-xl flex justify-between items-center"
            >
              <span class="text-red-400 uppercase text-xs font-bold">TILTS</span
              >
              <span class="text-xl font-mono text-red-500"
                >{buttonStats.tilt}</span
              >
            </div>
          </div>
          <div class="flex justify-center my-8">
            <div
              class="relative w-full max-w-md h-[500px] bg-slate-900 rounded-3xl border-4 border-slate-700 shadow-2xl overflow-hidden {currentInput.tilt
                ? 'animate-shake'
                : ''}"
            >
              <svg viewBox="0 0 300 500" class="w-full h-full drop-shadow-lg">
                <defs>
                  <linearGradient
                    id="grad1"
                    x1="0%"
                    y1="0%"
                    x2="100%"
                    y2="100%"
                  >
                    <stop
                      offset="0%"
                      style="stop-color:#1e293b;stop-opacity:1"
                    />
                    <stop
                      offset="100%"
                      style="stop-color:#0f172a;stop-opacity:1"
                    />
                  </linearGradient>
                </defs>
                <rect width="300" height="500" fill="url(#grad1)" />

                <path
                  d="M 20 20 L 20 450 Q 20 490 110 490"
                  fill="none"
                  stroke="#334155"
                  stroke-width="5"
                />
                <path
                  d="M 280 20 L 280 450 Q 280 490 190 490"
                  fill="none"
                  stroke="#334155"
                  stroke-width="5"
                />

                <g transform="translate(150, 400)">
                  <circle
                    r="20"
                    fill={currentInput.start ? "#22c55e" : "#1e293b"}
                    stroke="#334155"
                    stroke-width="3"
                    class="transition-colors duration-100"
                  />
                  <text
                    x="0"
                    y="5"
                    text-anchor="middle"
                    font-size="10"
                    fill="white"
                    font-weight="bold"
                    pointer-events="none">START</text
                  >
                  {#if currentInput.start}
                    <circle
                      r="25"
                      fill="none"
                      stroke="#22c55e"
                      stroke-width="2"
                      opacity="0.5"
                      class="animate-ping"
                    />
                  {/if}
                </g>

                <g transform="translate(260, 420)">
                  <rect
                    x="-15"
                    y="-20"
                    width="30"
                    height="40"
                    rx="2"
                    fill={currentInput.coin ? "#eab308" : "#334155"}
                    class="transition-colors duration-200"
                  />
                  <rect x="-2" y="-12" width="4" height="24" fill="#0f172a" />
                  <text
                    x="0"
                    y="30"
                    text-anchor="middle"
                    font-size="8"
                    fill="#94a3b8">COIN</text
                  >
                </g>

                <g transform="translate(40, 460)">
                  <circle
                    cx="5"
                    cy="15"
                    r="8"
                    fill="#475569"
                    stroke="#94a3b8"
                    stroke-width="1"
                  />

                  <path
                    d="M 0 0 L 90 10 L 85 20 L 0 30 Z"
                    fill="#ef4444"
                    stroke="white"
                    stroke-width="2"
                    class="transition-transform duration-75 ease-out"
                    style="
                transform-box: fill-box;
                transform-origin: left 5px 15px;
                /* Rotation Positive = Pointe descend / Rotation Négative = Pointe monte */
                transform: {currentInput.leftFlipper
                      ? 'rotate(-40deg)'
                      : 'rotate(25deg)'}
            "
                  />
                </g>

                <g transform="translate(260, 460)">
                  <circle
                    cx="-5"
                    cy="15"
                    r="8"
                    fill="#475569"
                    stroke="#94a3b8"
                    stroke-width="1"
                  />

                  <path
                    d="M 0 0 L -90 10 L -85 20 L 0 30 Z"
                    fill="#ef4444"
                    stroke="white"
                    stroke-width="2"
                    class="transition-transform duration-75 ease-out"
                    style="
                transform-box: fill-box;
                transform-origin: right 5px 15px;
                /* Rotation Positive = Pointe monte (car inversé en X) / Rotation Négative = Pointe descend */
                transform: {currentInput.rightFlipper
                      ? 'rotate(-40deg)'
                      : 'rotate(25deg)'}
            "
                  />
                </g>

                <circle cx="150" cy="150" r="15" fill="#ef4444" opacity="0.8" />
                <circle cx="80" cy="120" r="15" fill="#ef4444" opacity="0.8" />
                <circle cx="220" cy="120" r="15" fill="#ef4444" opacity="0.8" />
              </svg>
              {#if currentInput.tilt}
                <div
                  class="absolute inset-0 flex items-center justify-center bg-red-500/20 z-10"
                >
                  <h1
                    class="text-6xl font-black text-red-600 tracking-tighter border-4 border-red-600 p-4 rotate-12"
                  >
                    TILT
                  </h1>
                </div>
              {/if}
            </div>
          </div>
        </div>

        <div
          class="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 p-6"
        >
          <h3 class="text-lg font-bold text-slate-700 mb-4">
            Flux d'événements (20 derniers)
          </h3>
          <div class="space-y-3">
            {#each flipperEvents as event (event.id)}
              <div
                class="flex items-center gap-4 p-3 rounded-lg bg-slate-50 border border-slate-100"
              >
                <span class="text-xs font-mono text-slate-400"
                  >{event.time}</span
                >
                <span
                  class="px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide
                                {event.type === 'buttons'
                    ? 'bg-blue-100 text-blue-700'
                    : event.type === 'tilt'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-gray-100 text-gray-700'}"
                >
                  {event.type}
                </span>
                <span class="text-sm font-medium text-slate-700 flex-1"
                  >{event.details}</span
                >
                <span
                  class="text-xs text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-100"
                  >{event.device}</span
                >
              </div>
            {/each}
            {#if flipperEvents.length === 0}
              <div class="text-center py-10 text-slate-400 italic">
                En attente d'action sur le flipper...
              </div>
            {/if}
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  /* Animation de tremblement pour le TILT */
  .animate-shake {
    animation: shake 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
  }

  @keyframes shake {
    10%,
    90% {
      transform: translate3d(-2px, 0, 0);
    }
    20%,
    80% {
      transform: translate3d(4px, 0, 0);
    }
    30%,
    50%,
    70% {
      transform: translate3d(-8px, 0, 0);
    }
    40%,
    60% {
      transform: translate3d(8px, 0, 0);
    }
  }
</style>
