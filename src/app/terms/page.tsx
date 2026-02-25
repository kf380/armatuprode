import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terminos y Condiciones - ArmatuProde",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-bg-primary text-text-primary px-5 md:px-8 py-12 mx-auto max-w-2xl">
      <Link
        href="/"
        className="inline-block mb-8 text-sm text-primary hover:underline"
      >
        &larr; Volver a ArmatuProde
      </Link>

      <h1 className="font-display text-2xl font-bold tracking-widest mb-2">
        TERMINOS Y CONDICIONES
      </h1>
      <p className="text-xs text-text-muted mb-8">
        Ultima actualizacion: 25 de febrero de 2026
      </p>

      <div className="space-y-6 text-sm text-text-secondary leading-relaxed">
        <section>
          <h2 className="font-display text-base font-bold text-text-primary mb-2">
            1. Aceptacion de los terminos
          </h2>
          <p>
            Al acceder y utilizar ArmatuProde aceptas estos terminos y
            condiciones en su totalidad. Si no estas de acuerdo con alguno de
            estos terminos, no utilices el servicio.
          </p>
        </section>

        <section>
          <h2 className="font-display text-base font-bold text-text-primary mb-2">
            2. Descripcion del servicio
          </h2>
          <p>
            ArmatuProde es una plataforma de entretenimiento que permite a los
            usuarios crear grupos, realizar predicciones sobre resultados de
            partidos de futbol, competir en rankings y participar en pozos de
            premios entre amigos.
          </p>
          <p className="mt-2">
            <strong>ArmatuProde NO es un sitio de apuestas.</strong> Los pozos de
            grupo son acuerdos privados entre amigos dentro de un grupo cerrado.
            La plataforma facilita la organizacion y el registro de
            contribuciones, pero no actua como casa de apuestas ni intermediario
            financiero.
          </p>
        </section>

        <section>
          <h2 className="font-display text-base font-bold text-text-primary mb-2">
            3. Registro y cuenta
          </h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Debes ser mayor de 18 anos para usar ArmatuProde.</li>
            <li>
              Sos responsable de mantener la seguridad de tu cuenta y
              contrasena.
            </li>
            <li>
              La informacion que proporciones debe ser veraz y actualizada.
            </li>
            <li>
              Nos reservamos el derecho de suspender o eliminar cuentas que
              violen estos terminos.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-base font-bold text-text-primary mb-2">
            4. Coins y compras
          </h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              Los &quot;coins&quot; son una moneda virtual dentro de ArmatuProde
              que se utiliza para adquirir boosters y otros elementos del juego.
            </li>
            <li>
              Los coins se pueden obtener gratuitamente mediante la actividad en
              la plataforma o comprarse con dinero real a traves de MercadoPago.
            </li>
            <li>
              Los coins no tienen valor monetario fuera de la plataforma y no
              son reembolsables ni canjeables por dinero real.
            </li>
            <li>
              Los coins tienen una fecha de expiracion de 90 dias desde su
              obtencion.
            </li>
            <li>
              Los precios de los packs de coins estan expresados en pesos
              argentinos (ARS) e incluyen impuestos aplicables.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-base font-bold text-text-primary mb-2">
            5. Pozos de grupo
          </h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              Los pozos de grupo son organizados por los administradores de cada
              grupo y representan un acuerdo entre los miembros del grupo.
            </li>
            <li>
              El monto de la entrada es definido por el administrador del grupo
              al momento de su creacion.
            </li>
            <li>
              Los pagos de entradas a pozos se procesan a traves de MercadoPago.
            </li>
            <li>
              La distribucion del pozo (1ro, 2do, 3ro) se define al crear el
              grupo y es visible para todos los miembros.
            </li>
            <li>
              ArmatuProde no cobra comision sobre los pozos de grupo. La
              plataforma solo facilita la organizacion.
            </li>
            <li>
              La distribucion de premios es responsabilidad del administrador del
              grupo. ArmatuProde no garantiza el pago de premios entre miembros.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-base font-bold text-text-primary mb-2">
            6. Pagos y MercadoPago
          </h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              Todos los pagos se procesan a traves de MercadoPago. Al realizar
              una compra, aceptas los{" "}
              <a
                href="https://www.mercadopago.com.ar/ayuda/terminos-y-condiciones_299"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                terminos y condiciones de MercadoPago
              </a>.
            </li>
            <li>
              Las compras de coins no son reembolsables una vez acreditadas en
              tu cuenta.
            </li>
            <li>
              En caso de problemas con el pago, contactanos y evaluaremos cada
              caso individualmente.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-base font-bold text-text-primary mb-2">
            7. Conducta del usuario
          </h2>
          <p>Al usar ArmatuProde te comprometes a:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>No usar la plataforma para actividades ilegales.</li>
            <li>
              No enviar mensajes ofensivos, discriminatorios o de acoso en el
              chat grupal.
            </li>
            <li>No intentar manipular el sistema de puntos o predicciones.</li>
            <li>
              No crear multiples cuentas para obtener beneficios indebidos.
            </li>
            <li>
              Respetar a los demas usuarios y administradores de grupos.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-base font-bold text-text-primary mb-2">
            8. Propiedad intelectual
          </h2>
          <p>
            Todo el contenido de ArmatuProde (diseno, codigo, marcas, logos) es
            propiedad de ArmatuProde y esta protegido por las leyes de propiedad
            intelectual aplicables. No se permite la reproduccion, distribucion o
            modificacion sin autorizacion previa.
          </p>
        </section>

        <section>
          <h2 className="font-display text-base font-bold text-text-primary mb-2">
            9. Limitacion de responsabilidad
          </h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              ArmatuProde se proporciona &quot;tal cual&quot; sin garantias de
              ningun tipo.
            </li>
            <li>
              No garantizamos la disponibilidad ininterrumpida del servicio.
            </li>
            <li>
              No somos responsables por perdidas derivadas del uso de la
              plataforma.
            </li>
            <li>
              No somos responsables por disputas entre miembros de un grupo
              respecto a pozos o premios.
            </li>
            <li>
              Los resultados de partidos y puntuaciones se obtienen de fuentes
              externas y pueden tener demoras o inexactitudes.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-base font-bold text-text-primary mb-2">
            10. Modificaciones del servicio
          </h2>
          <p>
            Nos reservamos el derecho de modificar, suspender o discontinuar
            cualquier aspecto del servicio en cualquier momento. Intentaremos
            notificar cambios significativos con anticipacion razonable.
          </p>
        </section>

        <section>
          <h2 className="font-display text-base font-bold text-text-primary mb-2">
            11. Cambios en los terminos
          </h2>
          <p>
            Podemos modificar estos terminos en cualquier momento. Los cambios
            entraran en vigencia al publicarse en la plataforma. El uso
            continuado del servicio despues de los cambios implica su
            aceptacion.
          </p>
        </section>

        <section>
          <h2 className="font-display text-base font-bold text-text-primary mb-2">
            12. Ley aplicable y jurisdiccion
          </h2>
          <p>
            Estos terminos se rigen por las leyes de la Republica Argentina.
            Cualquier disputa sera sometida a la jurisdiccion de los tribunales
            ordinarios de la Ciudad Autonoma de Buenos Aires.
          </p>
        </section>

        <section>
          <h2 className="font-display text-base font-bold text-text-primary mb-2">
            13. Contacto
          </h2>
          <p>
            Para consultas sobre estos terminos, escribinos a{" "}
            <a
              href="mailto:contacto@armatuprode.com.ar"
              className="text-primary underline"
            >
              contacto@armatuprode.com.ar
            </a>.
          </p>
        </section>
      </div>

      <div className="mt-12 pt-6 border-t border-border-default text-xs text-text-muted text-center">
        ArmatuProde &copy; {new Date().getFullYear()} |{" "}
        <Link href="/privacy" className="text-primary hover:underline">
          Politica de Privacidad
        </Link>
      </div>
    </div>
  );
}
