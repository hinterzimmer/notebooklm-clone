# Protokoll: Krisen- & Status-Meeting „Rollout NEXUS-7 & Vorfall Werk Leipzig“

**Datum:** 14. Oktober 2026, 10:00 – 11:45 Uhr  
**Ort:** Hybrid (München Konferenzraum „Asimov“ / MS Teams)  
**Teilnehmer:**  
*   Thomas Bergmann (VP Operations – *Protokollführer*)  
*   Dr. Elena Rostova (Lead Systems Architect, zugeschaltet aus Dresden)  
*   Stefan Lindner (Key Account Manager für Pilotkunde „AutoNova AG“)  
*   Dr. Markus Vance (Data Protection Officer – zeitweise anwesend)  

---

## TOP 1: Analyse des Vorfalls beim Pilotkunden „AutoNova AG“ (Werk Leipzig)
**Hintergrund:** Am 12. Oktober 2026 kam es im Karosseriewerk der AutoNova AG in Leipzig zu einem Produktionsstillstand von 3,5 Stunden, ausgelöst durch zwei Vorserienmodelle des NEXUS-7 (Einheiten NX7-004 und NX7-009).

**Bericht von Stefan Lindner:**
Die Einheiten transportierten um 14:20 Uhr Bauteile durch Sektor C. Plötzlich leiteten beide Roboter kurz hintereinander eine abrupte Vollbremsung ein. Bei Einheit NX7-004 verrutschte dabei ein unzureichend gesicherter Spezialbehälter des Kunden, fiel zu Boden und beschädigte ein Bodenleitblech. Personen kamen nicht zu Schaden. Der Schichtleiter von AutoNova versuchte, die Roboter über das zentrale Tablet-Dashboard (WLAN) neu zu starten und wegzufahren, was jedoch fehlschlug, da die Geräte im Sicherheits-Lockdown waren. Erst nach 45 Minuten fand ein Techniker den physischen Drehschalter am Rückenmodul. AutoNova droht nun mit einer Vertragsstrafe von 120.000 Euro, falls wir die Ursache nicht bis Ende des Monats beheben.

**Technische Diagnose durch Dr. Elena Rostova:**
Die Auswertung der Blackbox-Logs (über Aetheris-GPT analysiert) ergab eindeutig den Fehlercode `ERR-NAV-SYNC-402`. 
*Ursache:* In Sektor C wurde kurz zuvor der hochglänzende Hallenboden feucht gereinigt. Gleichzeitig schien die Nachmittagssonne durch die westlichen Oberlichter direkt auf die nassen Stellen. Die Tiefenkameras interpretierten die Lichtreflexion als ein plötzlich auftauchendes, 2 Meter tiefes Loch im Boden, während das LiDAR korrekterweise einen ebenen Boden meldete. Nach exakt 400 ms griff das Sicherheitsprotokoll und löste den Not-Halt aus.
*Maßnahme:* Wir müssen bei AutoNova sofort den Software-Patch `v4.2.1-beta` aufspielen. Dieser senkt die Gewichtung der RGB-D-Kameras bei erkannter Bodenfeuchtigkeit. Elena weist jedoch darauf hin, dass dieser Patch noch nicht final für die Sicherheitsstufe SIL-3 zertifiziert ist, sondern eine Sondergenehmigung des Kunden erfordert.

---

## TOP 2: Beschwerde über Ladezeiten im Schichtbetrieb (AutoNova AG)
Stefan Lindner berichtet weiter, dass sich die Logistikleitung in Leipzig darüber beschwert, dass die Roboter in der Nachmittagsschicht statt der versprochenen 22 Minuten oft über eine Stunde an den Induktionsladestationen stehen.
**Antwort von Elena Rostova:** Die Ladebuchten in Leipzig wurden vom Kunden direkt neben den Lackier-Trockenöfen installiert. Dort herrschen konstant 36 °C. Wenn die Roboter im Dreischichtbetrieb permanent schnellgeladen werden, greift unser Überhitzungsschutz (`WARN-BMS-THERM-09`), weil der Inverter über 78 °C heiß wird. Das ist kein Bug, sondern ein Schutzmechanismus der Festkörperbatterie! AutoNova muss entweder die Ladebuchten verlegen oder für eine aktive Kühlung der Ladezone sorgen.

---

## TOP 3: Interner Sicherheitsvorfall & HR-Themen
**Bericht von Dr. Markus Vance (DPO):**
1.  **Verstoß gegen KI-Richtlinien:** Letzte Woche hat ein Werkstudent aus dem Marketing-Team das komplette, unveröffentlichte Preisblatt und die Kundenliste der NEXUS-7-Serie in ein öffentliches KI-Tool (ChatGPT Free) hochgeladen, um daraus eine Präsentation erstellen zu lassen. Da es sich um Daten der **Stufe 3 (Vertraulich)** handelt, stellt dies einen schweren Verstoß gegen Abschnitt 3.2 des Mitarbeiterhandbuchs dar. Der Systemzugang des Werkstudenten wurde durch Sarah Jenkins (CERT-Team) gesperrt.
2.  **Workation-Antrag von Dr. Elena Rostova:** Elena hat beantragt, im November für drei Wochen von Portugal aus zu arbeiten (Workation). 
    *Entscheidung von Dr. Vance:* Der Antrag muss leider **abgelehnt** werden. Zwar liegt Portugal in der EU und 15 Arbeitstage sind unter dem Limit von 20 Tagen, aber Elena arbeitet als Lead Architect direkt am „Project Chronos“ (der Nachfolge-Steuerungsarchitektur) und hat zudem eine 4-Tage-Präsenzpflicht im Dresdner Labor. Damit greift das Ausschlusskriterium aus dem Handbuch.
3.  **Spesen-Erinnerung:** Thomas Bergmann erinnert das Team daran, dass die Reisekostenabrechnungen für den Kundenbesuch in Leipzig (inkl. des Hotels für 210 €/Nacht, welches Thomas ausnahmsweise wegen der Leipziger Buchmesse vorab genehmigt hatte) zwingend bis zum **10. Werktag im November** über „SpendFlow“ eingereicht werden müssen.

---

## TOP 4: Nächste Schritte (Action Items)
*   **Stefan Lindner:** Klärt bis zum 18. Oktober mit AutoNova, ob sie die Haftungsfreistellung für das Aufspielen von Patch `v4.2.1-beta` unterschreiben, und informiert sie über das Temperaturproblem an den Trockenöfen.
*   **Dr. Elena Rostova:** Bereitet das Deployment des Patches für die Einheiten in Leipzig vor.
*   **Thomas Bergmann:** Organisiert eine Nachschulung für das Team von AutoNova bezüglich der Not-Aus-Prozeduren (Nutzung des Kill-Switch statt Tablet-Steuerung bei kritischen Fehlern).