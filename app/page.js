import Link from "next/link";

const STEPS = [
  {
    n: "01",
    title: "Upload your movie",
    body: "Add a movie you own to your library so it's ready for smooth, buffer-free playback.",
  },
  {
    n: "02",
    title: "Create a private room",
    body: "Spin up a room in seconds and invite only the people you choose, with a shareable code.",
  },
  {
    n: "03",
    title: "Watch in perfect sync",
    body: "Play, pause and seek together while you chat and react in real time.",
  },
];

const FAQ = [
  {
    q: "Is playback really synced for everyone?",
    a: "Whoever plays, pauses, or seeks broadcasts that instantly to the room, and everyone's player periodically re-syncs, so drift stays under a second.",
  },
  {
    q: "Who can join my room?",
    a: "Only people you share the room code or invite link with. Rooms aren't discoverable or public.",
  },
  {
    q: "What can I upload?",
    a: "Only video content you own or have the rights to share — this is a private watch-party tool, not a hosting or streaming platform.",
  },
];

export default function Home() {
  return (
    <main>
      <nav className="max-w-6xl mx-auto px-6 flex items-center justify-between py-6">
        <span className="font-semibold text-lg flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg bg-accent inline-block" />
          WatchTogether
        </span>
        <div className="hidden sm:flex gap-8 text-sm text-neutral-400">
          <a href="#features">Features</a>
          <a href="#how-it-works">How it works</a>
          <a href="#faq">FAQ</a>
        </div>
        <div className="flex gap-3">
          <Link href="/login" className="px-4 py-2 text-sm text-neutral-300 hover:text-white">
            Sign in
          </Link>
          <Link
            href="/signup"
            className="px-4 py-2 text-sm bg-accent rounded-lg hover:opacity-90 font-medium"
          >
            Get started
          </Link>
        </div>
      </nav>

      <section className="max-w-4xl mx-auto px-6 py-24 text-center relative">
        <div className="absolute inset-x-0 top-0 h-96 bg-accent/10 blur-3xl -z-10 rounded-full" />
        <p className="inline-block px-3 py-1 mb-6 rounded-full text-xs bg-neutral-900 border border-neutral-800 text-neutral-400">
          Private watch parties for your favourite people
        </p>
        <h1 className="text-4xl sm:text-6xl font-bold tracking-tight">
          Every movie night is{" "}
          <span className="bg-gradient-to-r from-accent to-fuchsia-400 bg-clip-text text-transparent">
            better together.
          </span>
        </h1>
        <p className="mt-6 text-neutral-400 max-w-xl mx-auto">
          Upload your movie, invite your friends, and experience every scene in
          sync — even when you're miles apart. Your cinema. Your people. One moment.
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Link
            href="/signup"
            className="px-6 py-3 bg-accent rounded-lg font-medium hover:opacity-90"
          >
            Start watching
          </Link>
          <a
            href="#how-it-works"
            className="px-6 py-3 rounded-lg font-medium border border-neutral-800 text-neutral-300 hover:border-neutral-700"
          >
            See how it works
          </a>
        </div>
      </section>

      <section id="features" className="max-w-6xl mx-auto px-6 grid sm:grid-cols-3 gap-6 py-8">
        {[
          { title: "Frame-perfect sync", body: "Play, pause and seek together — everyone sees the same moment." },
          { title: "Live chat & reactions", body: "React and chat without ever covering the screen." },
          { title: "Private rooms", body: "Share a room code with only the people you invite." },
        ].map((f) => (
          <div key={f.title} className="p-6 rounded-xl bg-neutral-900 border border-neutral-800">
            <h3 className="font-semibold mb-2">{f.title}</h3>
            <p className="text-sm text-neutral-400">{f.body}</p>
          </div>
        ))}
      </section>

      <section id="how-it-works" className="max-w-6xl mx-auto px-6 py-24">
        <div className="grid sm:grid-cols-3 gap-8">
          {STEPS.map((s) => (
            <div key={s.n}>
              <p className="text-xs text-accent font-mono mb-3">{s.n}</p>
              <h3 className="text-lg font-semibold mb-2">{s.title}</h3>
              <p className="text-sm text-neutral-400">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="faq" className="max-w-3xl mx-auto px-6 py-24">
        <p className="text-xs uppercase tracking-wide text-accent mb-2 text-center">FAQ</p>
        <h2 className="text-3xl font-bold text-center mb-2">Questions, answered.</h2>
        <p className="text-neutral-400 text-center mb-10">
          Everything you might want to know before your first watch party.
        </p>
        <div className="space-y-3">
          {FAQ.map((f) => (
            <details key={f.q} className="p-5 rounded-xl bg-neutral-900 border border-neutral-800 group">
              <summary className="cursor-pointer font-medium list-none flex items-center justify-between">
                {f.q}
                <span className="text-neutral-500 group-open:rotate-45 transition-transform">+</span>
              </summary>
              <p className="text-sm text-neutral-400 mt-3">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <footer className="py-10 text-center text-xs text-neutral-500 border-t border-neutral-900">
        Only upload or share content you own or have permission to share.
      </footer>
    </main>
  );
}
