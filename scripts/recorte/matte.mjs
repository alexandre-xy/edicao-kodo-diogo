// Recorte do expert com Robust Video Matting (ONNX, só Node): vídeo -> vídeo de máscara (cinza, branco = pessoa)
//   node matte.mjs <entrada.mp4> <saida_matte.mp4> [--ss 15] [--t 4] [--fps 30] [--dr 0.25]
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ort from 'onnxruntime-node';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const [inp, out] = args.filter((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
const W = 1080, H = 1920;
const fps = opt('fps', '30');
const dr = Number(opt('dr', '0.25'));
const here = path.dirname(fileURLToPath(import.meta.url));

const sess = await ort.InferenceSession.create(path.join(here, 'rvm.onnx'), { intraOpNumThreads: 4 });
const zero = () => new ort.Tensor('float32', new Float32Array([0]), [1, 1, 1, 1]);
let rec = [zero(), zero(), zero(), zero()];
const drT = new ort.Tensor('float32', new Float32Array([dr]), [1]);

const dec = spawn('ffmpeg', ['-v', 'error', '-ss', opt('ss', '0'), '-t', opt('t', '4'), '-i', inp,
  '-vf', `fps=${fps},scale=${W}:${H}`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']);
const enc = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'gray', '-s', `${W}x${H}`, '-r', fps, '-i', '-',
  '-c:v', 'libx264', '-crf', '12', '-pix_fmt', 'yuv420p', out]);

const N = W * H;
const frameBytes = N * 3;
let buf = Buffer.alloc(0);
let count = 0;
const t0 = Date.now();
const queue = [];
dec.stdout.on('data', (d) => { buf = Buffer.concat([buf, d]); while (buf.length >= frameBytes) { queue.push(buf.subarray(0, frameBytes)); buf = buf.subarray(frameBytes); } });
const ended = new Promise((r) => dec.on('close', r));

async function processFrame(px) {
  const src = new Float32Array(3 * N);
  for (let i = 0; i < N; i++) { src[i] = px[3 * i] / 255; src[N + i] = px[3 * i + 1] / 255; src[2 * N + i] = px[3 * i + 2] / 255; }
  const res = await sess.run({ src: new ort.Tensor('float32', src, [1, 3, H, W]), r1i: rec[0], r2i: rec[1], r3i: rec[2], r4i: rec[3], downsample_ratio: drT });
  rec = [res.r1o, res.r2o, res.r3o, res.r4o];
  const pha = res.pha.data;
  const g = Buffer.alloc(N);
  for (let i = 0; i < N; i++) g[i] = Math.max(0, Math.min(255, Math.round(pha[i] * 255)));
  if (!enc.stdin.write(g)) await new Promise((r) => enc.stdin.once('drain', r));
  count++;
}

let done = false;
ended.then(() => { done = true; });
while (!done || queue.length) {
  if (queue.length) await processFrame(queue.shift());
  else await new Promise((r) => setTimeout(r, 20));
}
enc.stdin.end();
await new Promise((r) => enc.on('close', r));
console.log(`${count} quadros em ${((Date.now() - t0) / 1000).toFixed(1)} s -> ${out}`);
