# Mastotags

Mastotags ist ein Webservice, der hilft, die populärsten Hashtags auf Mastodon zu finden, die mit bestimmten Events, Themen oder Veranstaltungen in Verbindung stehen.

## Funktionen

- Suche nach Themen oder Events (z.B. "Bundestagswahl", "Olympia")
- Anzeige der am häufigsten verwendeten Hashtags zum Thema
- Visuelle Darstellung der Popularität durch Farbcodierung

## Technologie

- Frontend: HTML, CSS, JavaScript und Bootstrap
- Datenzugriff: Mastodon API (mastodon.social)
- Keine Anmeldung oder Authentifizierung erforderlich

## Lokale Entwicklung

1. Repository klonen
2. Testserver starten:
   ```
   python3 server.py
   ```
3. Im Browser öffnen: http://localhost:8000

## Hinweise

- Der Service verwendet nur öffentliche API-Endpunkte ohne Authentifizierung
- Es werden nur öffentliche Toots analysiert
- Die Ergebnisse basieren auf den neuesten verfügbaren Toots

## Hosting

Die Anwendung ist für das Hosting auf GitHub Pages ausgelegt. 