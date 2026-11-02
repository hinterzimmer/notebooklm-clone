# Technische Dokumentation & Systemarchitektur: Autonome Logistikeinheit „NEXUS-7“

**Dokumenten-ID:** TECH-SPEC-NX7-REV2.4  
**Autor:** Dr. Elena Rostova (Lead Systems Architect)  
**Status:** Freigegeben für Vorserienproduktion  
**Klassifizierung:** Stufe 3 (Vertraulich)

---

## 1. Systemübersicht
Der **NEXUS-7** ist ein vollautonomer, omnidirektionaler Schwerlast-Transportroboter (AMR – Autonomous Mobile Robot) der neuesten Generation. Er wurde speziell für hochdynamische Produktionsumgebungen (Automobilindustrie, Luft- und Raumfahrt sowie große Pharmalager) entwickelt, in denen Mensch und Maschine im selben Sicherheitsbereich agieren.

---

## 2. Mechanische & Elektrische Kerndaten

*   **Abmessungen (L x B x H):** 1.450 mm x 880 mm x 420 mm (ohne Hubmodul)
*   **Eigengewicht:** 310 kg (inkl. Batteriemodul)
*   **Maximale Nutzlast (Payload):** 1.250 kg bei ebenem Industrieboden; 850 kg bei Steigungen bis zu 8 %.
*   **Maximale Geschwindigkeit:** 
    *   Freifahrtmodus (reine Roboterzone): 3,2 m/s (ca. 11,5 km/h)
    *   Kollaborativer Modus (Mensch-Maschine-Zone): automatisch gedrosselt auf 1,1 m/s
*   **Antriebssystem:** 4x bürstenlose Mecanum-Radnabenmotoren (Aetheris DriveCore v3), ermöglicht 360°-Drehungen auf der Stelle sowie diagonale und seitliche Fahrten.

### 2.1 Energieversorgung & Thermalmanagement
Der NEXUS-7 nutzt die proprietäre **„VoltCell Solid-State“-Festkörperbatterie** (72V, 120 Ah).
*   **Laufzeit unter Volllast:** Bis zu 14,5 Stunden.
*   **Ladezeit (Induktions-Schnellladesystem „AetherCharge“):** Von 10 % auf 80 % in **22 Minuten**.
*   **Zulässige Betriebstemperatur:** -15 °C bis +45 °C.
*   *Bekanntes thermisches Verhalten:* Bei kontinuierlichen Ladevorgängen mit der Schnellladefunktion (mehr als 3 Zyklen hintereinander ohne Abkühlphase) und einer Umgebungstemperatur von über 32 °C kann die Temperatur des Lade-Inverters auf über 78 °C ansteigen. In diesem Fall drosselt das Battery Management System (BMS) die Ladeleistung automatisch auf 30 %, was die Ladezeit auf ca. 65 Minuten verlängert (Fehlercode: `WARN-BMS-THERM-09`).

---

## 3. Sensorik & Navigation (Cortex-NavOS v4.2)
Die Umgebungswahrnehmung basiert auf einer redundanten Sensorfusion:
1.  **Primärsensorik:** 2x 360°-Festkörper-LiDAR (diagonal versetzt an den Fahrzeugecken für lückenlose Rundumsicht, Reichweite 45 Meter).
2.  **Sekundärsensorik:** 4x Stereoskopische Tiefenkameras (RGB-D) mit Infrarot-Projektoren zur Erkennung von überhängenden Lasten (z. B. Gabelstaplerzinken).
3.  **Tertiärsensorik:** 12x Ultraschallsensoren im unteren Chassis-Ring zur Nahbereichsabsicherung (0,05 m bis 1,2 m).

### 3.1 Einschränkungen der Sensorik (Edge Cases)
Trotz der hohen Zuverlässigkeit von Cortex-NavOS v4.2 gibt es dokumentierte physikalische Grenzbereiche:
*   **Hochreflektierende Oberflächen & Pfützen:** Wenn auf stark polierten Epoxidharzböden Flüssigkeitsfilme (z. B. Öl oder Reinigungswasser) stehen und gleichzeitig starkes Streiflicht (z. B. tiefstehende Sonne durch Hallenfenster oder defekte LED-Fluter mit einer Frequenz unter 100 Hz) einfällt, kann es zu **Geisterhindernissen (Phantom-Cluttering)** in den RGB-D-Kameras kommen.
*   **Systemreaktion:** Bei einer Diskrepanz zwischen LiDAR (sieht freien Weg) und RGB-D-Kamera (meldet Hindernis durch Spiegelung) von mehr als 400 Millisekunden greift die Sicherheitslogik und löst eine **Notbremsung der Kategorie 1** aus (Fehlercode: `ERR-NAV-SYNC-402`).

---

## 4. Wartung & Fehlerbehebung (Troubleshooting)

| Fehlercode | Beschreibung | Ursache | Lösungsansatz |
| :--- | :--- | :--- | :--- |
| `WARN-BMS-THERM-09` | Thermische Drosselung beim Laden | Inverter > 78 °C bei Schnellladung | Gerät für 30 Min. in den Ruhezustand versetzen; Lüftergitter an der Unterseite auf Staub prüfen. |
| `ERR-NAV-SYNC-402` | Sensor-Desynchronisation (Not-Halt) | Abweichung LiDAR vs. Tiefenkamera (oft durch Spiegelungen) | Boden auf Flüssigkeiten prüfen; Kameras mit Isopropanol reinigen; **Workaround:** Temporäres Update auf Patch `v4.2.1-beta` aufspielen (reduziert Kamera-Gewichtung bei Nässe). |
| `CRIT-MOT-LOCK-01` | Blockade Radnabenmotor hinten rechts | Mechanisches Hindernis oder defekter Hall-Sensor | Physischen Kill-Switch betätigen! Rad freiheben. Falls weiterhin blockiert: Komplettaustausch des DriveCore-Moduls durch Level-3-Techniker. |

---

## 5. Schnittstellen & Integration
Der NEXUS-7 unterstützt den Industriestandard **VDA 5050** (Version 2.0) zur Kommunikation mit übergeordneten Flottenmanagementsystemen. Die Datenübertragung erfolgt verschlüsselt (TLS 1.3) über lokales 5G-Campusnetz oder Wi-Fi 6E.