# ClipSnap – forbedringsforslag

Gennemgang af kodebasen pr. 2026-11-16. Status opdateret samme dag efter første implementeringsrunde (commit `f3c7413`). Ændringerne er dækket af tests, men endnu ikke afprøvet manuelt i Chrome.

## 1. Skær tilladelserne ned – ✅ gjort

- ✅ **Statisk content script på `<all_urls>`:** fjernet. `content.js` injiceres ved behov med `activeTab` + `scripting`.
- ✅ **`tabs`-tilladelsen:** fjernet. Sider, som `activeTab` ikke kan nå, fanges, når injektionen fejler, og giver det samme `!`-badge.
- ✅ **`web_accessible_resources`:** fjernet. Resize sker nu i service workeren med `OffscreenCanvas` (`lib/render.js`), og `content.js` skriver kun til udklipsholderen og viser toast.

Tilladelserne er nu `activeTab`, `clipboardWrite`, `contextMenus`, `scripting` og `storage`. En test låser listen.

## 2. Fejl og kvalitet i selve capture-flowet – ✅ gjort

- ✅ **Sløret nedskalering:** billedet halveres trinvist med `imageSmoothingQuality = "high"`, indtil det er højst dobbelt så bredt som målet (`planDownscaleSteps` i `lib/resize.js`).
- ✅ **Toast kommer med på billedet:** siden fjerner en eventuel gammel toast og venter på, at skærmen er tegnet om, før der tages billede.
- ✅ **Fejl-badge hænger ved:** `ERR` og `!` ryddes selv efter 4 sekunder.
- ✅ **Fokusfejl:** brugeren får "Click the page and try again" i stedet for den rå fejltekst.
- ✅ **Genvejslinket:** åbnes nu med `chrome.tabs.create`.

## 3. Nye funktioner, sorteret efter værdi pr. indsats

1. ✅ **Preset "1x":** skalerer efter sidens `devicePixelRatio`. Standardvalget er stadig `1280px`. Det er en åben produktbeslutning, om "1x" skal være standard.
2. ✅ **Hurtigt preset-skift:** højreklik-menu på ikonet med alle presets som valgknapper. Markeringen følger med, når preset ændres andre steder.
3. ✅ **Størrelse i toasten:** fx "1280×800 · 310 KB".
4. ⬜ **Udsnit:** træk en firkant og kopiér kun den. Det er den største funktion, men også den, der flytter appen mest.
5. ⬜ **Brugerdefineret bredde:** et frit talfelt ved siden af presets.

Fuld-side-capture frarådes for nu: det er besværligt med sticky headers og lazy loading, og det passer dårligt til "ét klik, færdig".

## 4. Oprydning

- ✅ **Død CSS:** `.roadmap-*` fjernet.
- ✅ **Overflødig kode:** `ensureDefaultPreset` fjernet.
- ✅ **Tests:** tilladelseslisten er låst, og capture-flowet, "1x", badge-rydning, preset-menuen og formatering er dækket. `content.js` har stadig ingen egne tests, fordi den kun kører i browseren.
- ⬜ **Indstillingssiden:** den er kun mørk og har en stor hero-sektion for én indstilling. Den kunne være en kompakt indlejret side (`options_ui`). Det er et designvalg, der bør drøftes først.

## Næste skridt

1. Afprøv manuelt i Chrome:
   - klik og genvej
   - en Retina-skærm
   - to captures lige efter hinanden
   - `chrome://`-sider og Chrome Web Store
   - capture, mens fokus er i adresselinjen
   - højreklik-menuen
2. Beslut om "1x" skal være standard.
3. Udgivelse i Chrome Web Store.
4. Derefter: brugerdefineret bredde, udsnit og indstillingssiden.
