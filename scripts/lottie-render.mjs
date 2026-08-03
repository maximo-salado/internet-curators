import puppeteer from "puppeteer-core";
import fs from "fs";

const files = process.argv.slice(2);
const browser = await puppeteer.launch({
  executablePath: "/usr/bin/brave-browser",
  headless: "new",
  args: ["--no-sandbox", "--disable-gpu"],
});
const page = await browser.newPage();
await page.setViewport({ width: 360, height: 540, deviceScaleFactor: 2 });

const lottieSrc = fs.readFileSync(
  "node_modules/lottie-web/build/player/lottie.js",
  "utf8"
);

for (const f of files) {
  const data = JSON.parse(fs.readFileSync(f, "utf8"));
  const frames = [0, Math.round(data.op * 0.5), data.op - 1];
  for (const fr of frames) {
    await page.setContent(
      `<body style="margin:0;background:#0a0a0a;display:flex;align-items:center;justify-content:center;height:100vh">
         <div id="c" style="width:300px;height:${Math.round(300 * (data.h / data.w))}px"></div>
       </body>`
    );
    await page.addScriptTag({ content: lottieSrc });
    const info = await page.evaluate((d, frame) => {
      const anim = window.lottie.loadAnimation({
        container: document.getElementById("c"),
        renderer: "svg",
        loop: false,
        autoplay: false,
        animationData: d,
      });
      anim.goToAndStop(frame, true);
      const svg = document.querySelector("#c svg");
      return { shapes: svg ? svg.querySelectorAll("path,rect,ellipse").length : 0 };
    }, data, fr);
    const name = f.split("/").pop().replace(".json", "");
    const out = `scripts/render-${name}-f${fr}.png`;
    await page.screenshot({ path: out });
    console.log(`${out}  (drawn shapes: ${info.shapes})`);
  }
}
await browser.close();
