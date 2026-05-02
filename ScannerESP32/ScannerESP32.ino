#include <WiFi.h>
#include <WebServer.h>
#include <WiFiManager.h>
#include <ESPmDNS.h>

const int ledPin = 2; // La LED integree

WebServer server(80);

void sendHeaders() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
}

void setup() {
  Serial.begin(115200);
  pinMode(ledPin, OUTPUT);
  digitalWrite(ledPin, LOW); 

  // Initialisation du gestionnaire de Wi-Fi
  WiFiManager wifiManager;

  // Decommente cette ligne si un jour tu veux forcer l'effacement du mot de passe sauvegarde pour faire un test
  // wifiManager.resetSettings();

  Serial.println("Tentative de connexion au Wi-Fi sauvegarde...");
  
  // Cette ligne fait tout le travail :
  // 1. Elle essaie de se connecter avec le mot de passe sauvegarde.
  // 2. Si ca echoue (ou si c'est la premiere fois), elle cree un reseau appele "ESP32_Configuration".
  // 3. Elle bloque le programme ici tant que tu n'as pas rentre tes identifiants sur ton telephone !
  if(!wifiManager.autoConnect("ESP32_Configuration")) {
    Serial.println("Echec de la configuration. Redemarrage...");
    delay(3000);
    ESP.restart();
  }

  // Si le code arrive ici, c'est que l'ESP32 est connectee a la box de ta maison !
  Serial.println("");
  Serial.println("Wi-Fi connecte avec succes !");
  Serial.print("Nouvelle Adresse IP : ");
  Serial.println(WiFi.localIP());

  // --- DEMARRAGE DU mDNS ---
  if (!MDNS.begin("mon-scanner")) {
    Serial.println("Erreur lors du demarrage du mDNS");
  } else {
    Serial.println("mDNS demarre avec succes !");
    Serial.println("Tu peux maintenant utiliser http://mon-scanner.local dans ton application React !");
  }

  // --- Les memes routes pour ton application React ---
  
  server.on("/", HTTP_OPTIONS, []() {
    sendHeaders();
    server.send(204);
  });

  server.on("/status", HTTP_GET, []() {
    sendHeaders();
    server.send(200, "application/json", "{\"status\":\"ok\", \"message\":\"ESP32 prete\"}");
  });

  server.on("/led/on", HTTP_GET, []() {
    digitalWrite(ledPin, HIGH);
    sendHeaders();
    server.send(200, "application/json", "{\"state\":\"ON\"}");
  });

  server.on("/led/off", HTTP_GET, []() {
    digitalWrite(ledPin, LOW);
    sendHeaders();
    server.send(200, "application/json", "{\"state\":\"OFF\"}");
  });

  server.begin();
  Serial.println("Serveur HTTP demarre, pret a ecouter React.");
}

void loop() {
  server.handleClient();
}