# Credits / 素材來源

The code in this repository is under the license in [LICENSE](LICENSE). The pictures and sounds
below come from elsewhere and keep their own licenses.

本專案的程式碼依 [LICENSE](LICENSE) 授權；以下圖片與音效來自其他來源，各自依原本的授權使用。

## Pictures / 圖片

Every cat picture was made for this project and traced into vector shapes, in `plugin/hooks/coat-art.ts`.
The thought cloud, keyboard, speech bubble, hearts and the other small marks are drawn in code in
`plugin/hooks/cats.ts`.

貓的圖都是為本專案製作，再描成向量圖形，放在 `plugin/hooks/coat-art.ts`。思考雲、鍵盤、對話框、愛心等小圖示是用程式碼畫的（`plugin/hooks/cats.ts`）。

| What | Where it is | Source |
| --- | --- | --- |
| The calico cat sitting | `CALICO` in `plugin/hooks/coat-art.ts` | Generated with AI image generation for this project, then traced |
| The tuxedo cat sitting | `TUXEDO` in `plugin/hooks/coat-art.ts` | Generated with Codex image generation from the calico cat, then traced; its dark paw repainted for this project |
| The calico and tuxedo asleep on the cushion | `cushion` in each coat in `plugin/hooks/coat-art.ts` | Generated with Codex image generation, then traced; the coat patterns repainted for this project |
| The Siamese cat, sitting and asleep | `SIAMESE` in `plugin/hooks/coat-art.ts` | Drawn in code for this project on the same traced cat: a cream coat with soft gradient points |
| The food cans beside the desktop cat | `desktop-app/tools/can-art.mjs`, built into `desktop-app/src/cans.js` | Drawn in code for this project |
| The fish in the thought cloud | `plugin/hooks/fish-art.ts` | Generated with Codex image generation, then traced and recoloured |

## Sounds / 音效

From [Pixabay](https://pixabay.com), under the [Pixabay Content License](https://pixabay.com/service/license-summary/),
then trimmed, levelled and looped with `desktop-app/tools/import_sound.py` for use in this app. They are not
covered by this repository's license and may not be redistributed on their own.

來自 Pixabay，依 Pixabay Content License 使用，並為本程式剪裁、調整音量與循環處理。不適用本專案的授權，也不可單獨拿出來散布。

| What | File | Source |
| --- | --- | --- |
| Typing while working | `desktop-app/src/sounds/typing.wav` | "Keyboard typing fast" by virtualzero on Pixabay |
| Meow, and the little mews cut from it | `desktop-app/src/sounds/meow.wav`, `mew.wav` | "Cat meow 8 fx" by sound_garage on Pixabay |
| Purring when petted | `desktop-app/src/sounds/purr.wav` | "Cat purr" by vinodadora on Pixabay |

## Website / 官網

The website in `docs/` was made for this project. Its cat and can pictures are the drawings above, written
out by `desktop-app/tools/build-site-art.mjs`.

官網（`docs/`）為本專案製作，貓和罐罐的圖就是上面那些圖，用 `desktop-app/tools/build-site-art.mjs` 匯出。

| What | Where it is | Source |
| --- | --- | --- |
| The intro video | `docs/media/desktop-cat-intro.mp4` | Made for this project from the desktop cat's own drawings and sounds |
| The video's music, "Bouncy Pocket" | In the intro video | Made with Suno for this project |
| The font, jf open 粉圓 | Loaded from Google Fonts, where it is called Huninn | By justfont, under the SIL Open Font License 1.1 |
