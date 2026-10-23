
// ======================================
// SMART PAKKETBOX - WEB BLE
// ======================================

// BLE configuratie.
// UUID's moeten overeenkomen met config.h
const CONFIG = {
    namePrefix: "Pakketbox-Lotfi",

    serviceUUID:
        "19b10000-e8f2-537e-4f6c-d104768a1214",

    commandUUID:
        "19b10001-e8f2-537e-4f6c-d104768a1214",

    statusUUID:
        "19b10002-e8f2-537e-4f6c-d104768a1214",

    commandOpen: 1,
    commandClose: 0,

    statusOpen: "Pakketbox open",
    statusClosed: "Pakketbox gesloten"
};

// BLE objecten
let device = null;
let commandCharacteristic = null;
let statusCharacteristic = null;

let connected = false;
let busy = false;

// HTML elementen
const connectBtn =
    document.getElementById("connectBtn");

const openBtn =
    document.getElementById("openBtn");

const closeBtn =
    document.getElementById("closeBtn");

const connectionStatus =
    document.getElementById("connectionStatus");

const connectionDot =
    document.getElementById("connectionDot");

const lockIcon =
    document.getElementById("lockIcon");

const lockStatus =
    document.getElementById("lockStatus");

const lockDescription =
    document.getElementById("lockDescription");

const notification =
    document.getElementById("notification");

const activityLog =
    document.getElementById("activityLog");

// ======================================
// INTERFACE
// ======================================

function updateButtons() {
    openBtn.disabled = !connected || busy;
    closeBtn.disabled = !connected || busy;
}

function addLog(message) {
    const time = new Date().toLocaleTimeString();

    const entry = document.createElement("p");
    entry.textContent = `${time} - ${message}`;

    activityLog.prepend(entry);
}

function showStatus(status) {

    if (status === CONFIG.statusOpen) {
        lockIcon.textContent = "🔓";
        lockStatus.textContent = "Pakketbox geopend";
        lockDescription.textContent =
            "Het slot is ontgrendeld";
    }
    else if (status === CONFIG.statusClosed) {
        lockIcon.textContent = "🔒";
        lockStatus.textContent = "Pakketbox gesloten";
        lockDescription.textContent =
            "Het slot is vergrendeld";
    }
    else {
        lockIcon.textContent = "📦";
        lockStatus.textContent = status;
        lockDescription.textContent =
            "Status ontvangen van ESP32";
    }

    notification.textContent = status;
    addLog(status);
}

// ======================================
// BLE VERBINDING
// ======================================

async function connectBLE() {

    if (!navigator.bluetooth) {
        notification.textContent =
            "Web Bluetooth niet beschikbaar. " +
            "Open deze pagina via HTTPS in Bluefy.";
        return;
    }

    if (connected && device) {
        device.gatt.disconnect();
        return;
    }

    connectBtn.disabled = true;
    connectBtn.textContent = "Verbinden...";

    try {
        // Gebruiker kiest pakketbox
        device = await navigator.bluetooth.requestDevice({
            filters: [
                { namePrefix: CONFIG.namePrefix }
            ],
            optionalServices: [
                CONFIG.serviceUUID
            ]
        });

        device.addEventListener(
            "gattserverdisconnected",
            onDisconnected
        );

        const server = await device.gatt.connect();

        const service =
            await server.getPrimaryService(
                CONFIG.serviceUUID
            );

        commandCharacteristic =
            await service.getCharacteristic(
                CONFIG.commandUUID
            );

        statusCharacteristic =
            await service.getCharacteristic(
                CONFIG.statusUUID
            );

        // Ontvangst van BLE notifications
        statusCharacteristic.addEventListener(
            "characteristicvaluechanged",
            handleNotification
        );

        await statusCharacteristic.startNotifications();

        connected = true;

        connectionStatus.textContent = "Verbonden";
        connectionDot.classList.add("connected");
        connectBtn.textContent = "Verbreken";

        addLog("Bluetooth verbonden");

        // Vraag de huidige status op
        const value =
            await statusCharacteristic.readValue();

        handleStatusValue(value);

    } catch (error) {
        console.error(error);

        notification.textContent =
            "Verbindingsfout: " + error.message;

        addLog("BLE verbinding mislukt");

        if (device && device.gatt.connected) {
            device.gatt.disconnect();
        }
    } finally {
        if (!connected) {
            connectBtn.textContent = "Verbinden";
        }

        connectBtn.disabled = false;
        updateButtons();
    }
}

// ======================================
// BLE VERBINDING VERBROKEN
// ======================================

function onDisconnected() {

    connected = false;
    busy = false;

    commandCharacteristic = null;
    statusCharacteristic = null;

    connectionStatus.textContent =
        "Niet verbonden";

    connectionDot.classList.remove("connected");

    connectBtn.textContent = "Verbinden";
    connectBtn.disabled = false;

    lockIcon.textContent = "📦";
    lockStatus.textContent = "Status onbekend";
    lockDescription.textContent =
        "Verbind met je pakketbox";

    notification.textContent =
        "Bluetoothverbinding verbroken";

    updateButtons();
    addLog("Bluetoothverbinding verbroken");
}

// ======================================
// BLE STATUS ONTVANGEN
// ======================================

function handleNotification(event) {

    const value = event.target.value;

    handleStatusValue(value);
}

function handleStatusValue(value) {

    // ESP32 verstuurt UTF-8 tekst
    const decoder = new TextDecoder("utf-8");

    const status = decoder.decode(value).trim();

    showStatus(status);
}

// ======================================
// BLE COMMANDO VERSTUREN
// ======================================

async function sendCommand(command) {

    if (!connected || !commandCharacteristic || busy) {
        return;
    }

    busy = true;
    updateButtons();

    try {
        // 1 byte: 1 = open, 0 = dicht
        const data = new Uint8Array([command]);

        if (commandCharacteristic.writeValueWithResponse) {
            await commandCharacteristic.writeValueWithResponse(data);
        }
        else {
            // Compatibiliteit met oudere Web BLE
            await commandCharacteristic.writeValue(data);
        }

        const action =
            command === CONFIG.commandOpen
                ? "Openen aangevraagd"
                : "Sluiten aangevraagd";

        notification.textContent =
            action + ". Wachten op bevestiging...";

        addLog(action);

        // De echte status komt daarna
        // van de ESP32 via BLE Notify.

    } catch (error) {
        notification.textContent =
            "Fout bij bediening: " + error.message;

        addLog("BLE opdracht mislukt");
    } finally {
        busy = false;
        updateButtons();
    }
}

// ======================================
// KNOPPEN
// ======================================

connectBtn.addEventListener(
    "click",
    connectBLE
);

openBtn.addEventListener("click", () => {
    sendCommand(CONFIG.commandOpen);
});

closeBtn.addEventListener("click", () => {
    sendCommand(CONFIG.commandClose);
});

// ======================================
// START
// ======================================

updateButtons();
addLog("Dashboard gestart");
