import { Brand } from "../components/Brand.js";

export function Home() {
  return (
    <main className="home shell">
      <Brand />
      <section className="home__content">
        <p className="eyebrow">Juego para compartir</p>
        <h1>Las palabras<br />entran en ronda.</h1>
        <p className="home__lead">
          Mostrá el rosco en una pantalla grande y conducí cada turno desde tu teléfono.
        </p>
        <div className="home__actions">
          <a className="button button--primary" href="/juego">Abrir pantalla de juego</a>
          <a className="button button--ghost" href="/control">Usar este dispositivo como control</a>
        </div>
      </section>
      <div className="home__orb" aria-hidden="true">
        {"ABCDEFGHIJLMNÑOPQRSTUVWXYZ".split("").map((letter, index) => (
          <span key={letter} style={{ "--index": index } as React.CSSProperties}>{letter}</span>
        ))}
      </div>
    </main>
  );
}

