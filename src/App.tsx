export default function App() {
  return (
    <main className="flex h-full flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-5xl font-light tracking-[0.2em] text-neutral-100 uppercase">Karraj</h1>
        <p className="font-mono text-xs tracking-[0.35em] text-neutral-500 uppercase">كراج</p>
      </div>

      <p className="max-w-md text-sm leading-relaxed text-neutral-400">
        A browser-based car configurator with a live Jordanian modification-compliance layer.
      </p>

      <p className="font-mono text-xs tracking-widest text-neutral-600 uppercase">
        Scaffold deployed &middot; scene pending
      </p>

      <footer className="fixed inset-x-0 bottom-0 p-4 text-[11px] leading-relaxed text-neutral-700">
        Car Concept &copy; 2024 Darmstadt Graphics Group GmbH, model and textures by Eric Chadwick,
        CC BY 4.0
      </footer>
    </main>
  )
}
