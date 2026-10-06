import { useEffect, useRef, useState } from "react"
import * as PIXI from "pixi.js"
import { Live2DModel } from "pixi-live2d-display/cubism2"
import { backgroundUrl, buildModelSettings } from "@/lib/bestdori/live2d"

;(window as any).PIXI = PIXI
Live2DModel.registerTicker(PIXI.Ticker as any)

export default function Live2DTest() {
  const host = useRef<HTMLDivElement>(null)
  const modelRef = useRef<any>(null)
  const [status, setStatus] = useState("Loading…")
  const [motion, setMotion] = useState("nf05")
  const [expression, setExpression] = useState("default")

  useEffect(() => {
    let dead = false
    const app = new PIXI.Application({ width: 1280, height: 720, backgroundColor: 0x000000 })
    host.current?.appendChild(app.view as HTMLCanvasElement)
    ;(app.view as HTMLCanvasElement).style.width = "100%"

    ;(async () => {
      try {
        const bg = PIXI.Sprite.from(backgroundUrl("bg/scenario57", "bg00570"))
        bg.width = 1280
        bg.height = 720
        app.stage.addChild(bg)

        const settings = await buildModelSettings("035_casual_winter-2023")
        const model: any = await Live2DModel.from(settings as any)
        if (dead) return
        modelRef.current = model
        const s = 720 / model.height
        model.scale.set(s * 1.1)
        model.anchor.set(0.5, 0)
        model.position.set(640, 40)
        app.stage.addChild(model)
        setStatus("Loaded")
      } catch (e) {
        setStatus("Error: " + (e instanceof Error ? e.message : String(e)))
      }
    })()

    return () => {
      dead = true
      app.destroy(true, { children: true })
    }
  }, [])

  return (
    <div className="mx-auto max-w-5xl space-y-3 p-4">
      <p className="text-sm opacity-70">{status}</p>
      <div ref={host} />
      <div className="flex flex-wrap gap-2">
        <input className="input !w-40" value={motion} onChange={(e) => setMotion(e.target.value)} />
        <button className="btn" onClick={() => modelRef.current?.motion(motion, 0)}>Play motion</button>
        <input className="input !w-40" value={expression} onChange={(e) => setExpression(e.target.value)} />
        <button className="btn" onClick={() => modelRef.current?.expression(expression)}>Set expression</button>
      </div>
    </div>
  )
}