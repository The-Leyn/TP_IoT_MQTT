<!-- <script> -->
<!--   let uri = "ws://localhost:8080"; -->
<!--   let status = "idle"; -->
<!--   let currentTemp = undefined; -->
<!--   function connect() { -->
<!--     status = "connecting"; -->
<!---->
<!--     const ws = new WebSocket(uri); -->
<!---->
<!--     ws.onopen = () => { -->
<!--       status = "open"; -->
<!--       ws.send("hello"); -->
<!--     }; -->
<!---->
<!--     ws.onerror = () => { -->
<!--       status = "error"; -->
<!--     }; -->
<!---->
<!--     ws.onclose = () => { -->
<!--       status = "closed"; -->
<!--     }; -->
<!---->
<!--     ws.onmessage = (e) => { -->
<!--       console.log(e.data); -->
<!--       currentTemp = JSON.parse(e.data).tempC; -->
<!--     }; -->
<!--   } -->
<!-- </script> -->
<!---->
<!-- <h1>Web connect Status : {status}</h1> -->
<!---->
<!-- <button class="monGrosBouton" onclick={connect}>Connect</button> -->
<!-- {#if currentTemp !== undefined} -->
<!--   <h2>La temperateure à Hetic est de {currentTemp}</h2> -->
<!-- {/if} -->
<!---->
<!-- <style> -->
<!--   .monGrosBouton { -->
<!--     border: solid 1px red; -->
<!--     border-radius: 5px; -->
<!--     padding: 2px 4px; -->
<!--   } -->
<!-- </style> -->

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

  // --- ÉTAT (Svelte 5 Runes) ---
  let status = $state("idle"); // idle, connecting, connected, error
  let devices = $state({}); // Notre base de données locale des capteurs
  let now = $state(Date.now()); // Sert à forcer le rafraichissement du temps

  // --- LOGIQUE ---
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

        // Si c'est un message de télémétrie (avec un deviceId)
        if (msg.deviceId) {
          // On met à jour ou on crée l'entrée pour ce device
          devices[msg.deviceId] = {
            ...msg.data, // tempC, humidity, battery...
            lastSeen: msg.timestamp, // Le timestamp ajouté par le serveur
          };
        }
      } catch (e) {
        console.error("Erreur de parsing", e);
      }
    };

    ws.onclose = () => (status = "disconnected");
    ws.onerror = () => (status = "error");
  }

  // Timer pour mettre à jour l'heure et l'état "Offline" en temps réel
  onMount(() => {
    connect(); // Connexion auto au chargement
    const interval = setInterval(() => {
      now = Date.now();
    }, 1000);
    return () => clearInterval(interval);
  });

  // --- HELPERS ---
  function getPlaceName(id) {
    return MAPPING_SALLES[id] || `Capteur ${id}`;
  }

  function isOffline(lastSeen) {
    // Considéré offline si pas de nouvelles depuis 15 secondes
    return now - lastSeen > 15000;
  }

  // --- BONUS UI LOGIQUE ---

  // 1. Variable pour la barre de recherche
  let searchTerm = $state("");

  // 2. Liste filtrée (Calculée automatiquement quand 'searchTerm' ou 'devices' change)
  let filteredList = $derived(
    Object.entries(devices).filter(([id, info]) => {
      const name = getPlaceName(id).toLowerCase();
      const search = searchTerm.toLowerCase();
      return name.includes(search) || id.includes(search);
    }),
  );

  // 3. Moyennes Globales (Calculées automatiquement)
  let averages = $derived.by(() => {
    const values = Object.values(devices);
    if (values.length === 0) return null;

    // On calcule la somme
    const totalTemp = values.reduce((sum, d) => sum + (d.tempC || 0), 0);
    const totalHum = values.reduce((sum, d) => sum + (d.humPct || 0), 0);

    return {
      temp: (totalTemp / values.length).toFixed(1),
      hum: (totalHum / values.length).toFixed(0),
    };
  });
</script>

<div class="min-h-screen bg-slate-50 p-6 md:p-12 font-sans text-slate-800">
  <header
    class="flex flex-col md:flex-row justify-between items-center mb-10 gap-4"
  >
    <div>
      <h1 class="text-3xl font-extrabold tracking-tight text-slate-900">
        Dashboard Météo
      </h1>
      <p class="text-slate-500">Supervision des salles HETIC en temps réel</p>
    </div>

    <div
      class="flex items-center gap-3 bg-white p-2 rounded-lg shadow-sm border border-slate-200"
    >
      <div class="flex items-center gap-2 px-3">
        <span class="relative flex h-3 w-3">
          {#if status === "connected"}
            <span
              class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"
            ></span>
            <span class="relative inline-flex rounded-full h-3 w-3 bg-green-500"
            ></span>
          {:else}
            <span class="relative inline-flex rounded-full h-3 w-3 bg-red-500"
            ></span>
          {/if}
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
        >
          Reconnecter
        </button>
      {/if}
    </div>
  </header>
  <div class="mb-8 flex flex-col md:flex-row gap-6 justify-between items-end">
    <div class="w-full md:w-1/3">
      <label class="block text-sm font-bold text-slate-500 mb-1" for="search"
        >Filtrer par lieu</label
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
      <div class="flex gap-4 bg-slate-800 text-white p-3 rounded-lg shadow-lg">
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
  <main class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
            <div class="flex flex-col items-end">
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
            </div>
          {/if}
        </div>

        <div class="grid grid-cols-2 gap-4 mb-4 pl-4">
          <div class="bg-blue-50 rounded-xl p-3">
            <span class="text-xs uppercase text-blue-400 font-bold"
              >Température</span
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
          <span>
            Dernière maj : {new Date(info.lastSeen).toLocaleTimeString()}
          </span>
          {#if offline}
            <span
              class="bg-red-100 text-red-600 px-2 py-1 rounded font-bold animate-pulse"
            >
              OFFLINE
            </span>
          {:else}
            <span class="text-green-600 font-bold flex items-center gap-1">
              <span class="w-1.5 h-1.5 bg-green-500 rounded-full"></span> LIVE
            </span>
          {/if}
        </div>
      </div>
    {/each}
  </main>

  {#if Object.keys(devices).length === 0 && status === "connected"}
    <div
      class="flex flex-col items-center justify-center mt-20 text-slate-400 gap-4"
    >
      <div class="loading loading-dots loading-lg text-blue-300"></div>
      <p>En attente des données des capteurs...</p>
      <p class="text-sm bg-slate-100 px-2 py-1 rounded">
        Topic : classroom/+/telemetry
      </p>
    </div>
  {/if}
</div>
