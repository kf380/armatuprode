import type { Metadata } from "next";
import Link from "next/link";
import {
  Users,
  Building2,
  Tv,
  Beer,
  Trophy,
  Link2,
  ListChecks,
  PenSquare,
  LayoutDashboard,
  Receipt,
  ArrowRight,
} from "lucide-react";
import { CheckBallLogo } from "@/components/CheckBallLogo";

export const metadata: Metadata = {
  title: "ArmaTuProde — Armá tu prode en minutos",
  description:
    "Creá un prode para tus amigos, tu bar, tu empresa o tu comunidad. Compartís el link, los jugadores entran gratis y todos compiten en un ranking privado.",
  openGraph: {
    title: "ArmaTuProde — Armá tu prode en minutos",
    description:
      "Creá un prode para tus amigos, tu bar, tu empresa o tu comunidad. Jugadores invitados entran gratis. Premio manual gestionado por el organizador.",
    type: "website",
  },
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      {/* Top nav */}
      <header className="sticky top-0 z-30 backdrop-blur bg-bg-primary/80 border-b border-border-default">
        <div className="mx-auto max-w-5xl px-5 md:px-8 py-3 flex items-center justify-between">
          <Link href="/landing" className="flex items-center gap-2">
            <CheckBallLogo size={32} />
            <span className="font-display text-xs font-bold tracking-[0.2em]">
              ARMATUPRODE
            </span>
          </Link>
          <Link
            href="/organizer/create"
            className="rounded-xl bg-primary px-3 py-1.5 text-[11px] font-display font-bold tracking-wider text-bg-primary hover:bg-primary/90 active:scale-[0.97]"
          >
            CREAR PRODE
          </Link>
        </div>
      </header>

      {/* 1. HERO */}
      <section className="mx-auto max-w-3xl px-5 md:px-8 py-12 md:py-20 text-center">
        <div className="flex justify-center mb-5">
          <CheckBallLogo size={88} />
        </div>
        <h1 className="font-display text-3xl md:text-5xl font-bold tracking-tight leading-[1.1] mb-4">
          Armá tu prode en minutos
        </h1>
        <p className="text-base md:text-lg text-text-secondary leading-relaxed max-w-2xl mx-auto mb-8">
          Creá un prode para tus amigos, tu bar, tu empresa o tu comunidad.
          Compartís el link, los jugadores entran gratis y todos compiten en
          un ranking privado.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/organizer/create"
            className="rounded-2xl bg-primary px-6 py-3.5 font-display text-sm font-bold tracking-widest text-bg-primary hover:bg-primary/90 active:scale-[0.98] inline-flex items-center justify-center gap-2"
          >
            CREAR MI PRODE <ArrowRight size={14} />
          </Link>
          <a
            href="#como-funciona"
            className="rounded-2xl border border-border-default bg-bg-surface px-6 py-3.5 font-display text-sm font-bold tracking-widest text-text-primary hover:border-primary/40 active:scale-[0.98] inline-flex items-center justify-center"
          >
            VER CÓMO FUNCIONA
          </a>
        </div>
        <p className="text-[11px] text-text-muted mt-6">
          Plan gratuito disponible · Sin tarjeta para empezar
        </p>
      </section>

      {/* 2. CÓMO FUNCIONA */}
      <section
        id="como-funciona"
        className="mx-auto max-w-4xl px-5 md:px-8 py-12 md:py-16"
      >
        <h2 className="font-display text-[10px] tracking-[0.25em] font-bold text-text-muted text-center mb-3">
          CÓMO FUNCIONA
        </h2>
        <h3 className="font-display text-2xl md:text-3xl font-bold text-center mb-10 leading-tight">
          Tres pasos para tener tu prode online
        </h3>
        <ol className="grid md:grid-cols-3 gap-4">
          {[
            {
              n: "01",
              icon: PenSquare,
              title: "Creás el prode",
              body: "Elegís el torneo, le ponés un nombre y un emoji. Definís un premio manual y reglas si querés.",
            },
            {
              n: "02",
              icon: Link2,
              title: "Compartís el link",
              body: "Mandás el link de invitación por WhatsApp, mail o donde quieras. Los jugadores entran gratis.",
            },
            {
              n: "03",
              icon: Trophy,
              title: "Compiten en el ranking",
              body: "Cada uno predice los partidos. La app calcula puntos automáticos y arma un ranking privado del grupo.",
            },
          ].map((step) => (
            <li
              key={step.n}
              className="rounded-2xl border border-border-default bg-bg-surface p-5"
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="font-display text-[10px] tracking-widest text-primary">
                  {step.n}
                </span>
                <step.icon size={18} className="text-primary" />
              </div>
              <div className="font-display font-bold text-base mb-1">
                {step.title}
              </div>
              <p className="text-sm text-text-secondary leading-relaxed">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {/* 3. PARA QUIÉN ES */}
      <section className="mx-auto max-w-4xl px-5 md:px-8 py-12 md:py-16">
        <h2 className="font-display text-[10px] tracking-[0.25em] font-bold text-text-muted text-center mb-3">
          PARA QUIÉN ES
        </h2>
        <h3 className="font-display text-2xl md:text-3xl font-bold text-center mb-10 leading-tight">
          Funciona para cualquier grupo
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: Users, title: "Amigos y familia", body: "Grupos chicos para el Mundial o cualquier torneo." },
            { icon: Beer, title: "Bares y comunidades", body: "Activá tu local con un prode propio para clientes." },
            { icon: Building2, title: "Empresas y equipos", body: "Engagement interno con un prode corporativo." },
            { icon: Tv, title: "Streamers o clubes", body: "Convocá a tu audiencia con un prode privado." },
          ].map((c) => (
            <div
              key={c.title}
              className="rounded-2xl border border-border-default bg-bg-surface p-4"
            >
              <c.icon size={20} className="text-primary mb-2" />
              <div className="font-display font-bold text-sm mb-1">{c.title}</div>
              <p className="text-xs text-text-muted leading-relaxed">{c.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 4. QUÉ INCLUYE */}
      <section className="mx-auto max-w-4xl px-5 md:px-8 py-12 md:py-16">
        <h2 className="font-display text-[10px] tracking-[0.25em] font-bold text-text-muted text-center mb-3">
          QUÉ INCLUYE
        </h2>
        <h3 className="font-display text-2xl md:text-3xl font-bold text-center mb-10 leading-tight">
          Todo lo que necesitás, nada de fricción
        </h3>
        <ul className="grid md:grid-cols-2 gap-3">
          {[
            { icon: Trophy, title: "Ranking privado", body: "Tabla por grupo con puntos y posiciones en tiempo real." },
            { icon: Link2, title: "Link de invitación", body: "Un link y listo. Los jugadores se suman gratis." },
            { icon: Trophy, title: "Premio manual", body: "Definís vos qué se lleva el ganador. La plataforma no procesa el premio." },
            { icon: ListChecks, title: "Reglas personalizadas", body: "Sumá las reglas que quieras: bonus, comodines, lo que sea." },
            { icon: LayoutDashboard, title: "Dashboard del organizador", body: "Vista propia con jugadores, configuración y estado del prode." },
            { icon: Receipt, title: "Billing del organizador", body: "Ves tu plan, tus pagos y el estado de cada orden en un solo lugar." },
          ].map((f) => (
            <li
              key={f.title}
              className="rounded-2xl border border-border-default bg-bg-surface p-4 flex gap-3"
            >
              <f.icon size={18} className="text-primary shrink-0 mt-0.5" />
              <div>
                <div className="font-display font-bold text-sm mb-0.5">{f.title}</div>
                <p className="text-xs text-text-secondary leading-relaxed">{f.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* 5. ACLARACIÓN */}
      <section className="mx-auto max-w-3xl px-5 md:px-8 py-10">
        <div className="rounded-2xl border border-border-default bg-bg-surface p-5 md:p-6">
          <h3 className="font-display text-[10px] tracking-[0.25em] font-bold text-text-muted mb-3">
            ACLARACIÓN IMPORTANTE
          </h3>
          <p className="text-sm md:text-base text-text-primary leading-relaxed">
            <strong>ArmaTuProde no es una casa de apuestas.</strong> En esta
            versión, los jugadores invitados entran gratis, el premio es
            manual y la plataforma no custodia ni reparte dinero
            automáticamente. El organizador gestiona el premio por fuera.
          </p>
          <p className="mt-3 text-xs text-text-muted">
            Mirá los{" "}
            <Link href="/terms" className="text-primary underline">
              términos y condiciones
            </Link>{" "}
            o la{" "}
            <Link href="/privacy" className="text-primary underline">
              política de privacidad
            </Link>{" "}
            para más detalles.
          </p>
        </div>
      </section>

      {/* 6. CTA FINAL */}
      <section className="mx-auto max-w-3xl px-5 md:px-8 py-16 md:py-24 text-center">
        <h3 className="font-display text-2xl md:text-4xl font-bold leading-tight mb-4">
          Creá tu primer prode gratis
        </h3>
        <p className="text-sm md:text-base text-text-secondary leading-relaxed max-w-xl mx-auto mb-8">
          En menos de un minuto tenés el link armado para mandar al grupo.
        </p>
        <Link
          href="/organizer/create"
          className="rounded-2xl bg-primary px-8 py-4 font-display text-base font-bold tracking-widest text-bg-primary hover:bg-primary/90 active:scale-[0.98] inline-flex items-center justify-center gap-2"
        >
          CREAR MI PRODE <ArrowRight size={16} />
        </Link>
        <p className="text-[11px] text-text-muted mt-5">
          Plan gratuito disponible · Jugadores invitados entran gratis
        </p>
      </section>

      <footer className="border-t border-border-default mt-8">
        <div className="mx-auto max-w-5xl px-5 md:px-8 py-6 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-text-muted">
          <div className="flex items-center gap-2">
            <CheckBallLogo size={20} />
            <span>ArmaTuProde © {new Date().getFullYear()}</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/terms" className="hover:text-text-primary">
              Términos
            </Link>
            <Link href="/privacy" className="hover:text-text-primary">
              Privacidad
            </Link>
            <Link href="/" className="hover:text-text-primary">
              Iniciar sesión
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
