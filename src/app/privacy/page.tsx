import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Politica de Privacidad - ArmatuProde",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-bg-primary text-text-primary px-5 md:px-8 py-12 mx-auto max-w-2xl">
      <Link
        href="/"
        className="inline-block mb-8 text-sm text-primary hover:underline"
      >
        &larr; Volver a ArmatuProde
      </Link>

      <h1 className="font-display text-2xl font-bold tracking-widest mb-2">
        POLITICA DE PRIVACIDAD
      </h1>
      <p className="text-xs text-text-muted mb-8">
        Ultima actualizacion: 25 de febrero de 2026
      </p>

      <div className="space-y-6 text-sm text-text-secondary leading-relaxed">
        <section>
          <h2 className="font-display text-base font-bold text-text-primary mb-2">
            1. Informacion que recopilamos
          </h2>
          <p>
            Al utilizar ArmatuProde recopilamos la siguiente informacion:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>
              <strong>Datos de cuenta:</strong> nombre, direccion de correo
              electronico y avatar que proporcionas al registrarte.
            </li>
            <li>
              <strong>Datos de uso:</strong> predicciones realizadas,
              participacion en grupos, puntuaciones y actividad dentro de la
              plataforma.
            </li>
            <li>
              <strong>Datos de pago:</strong> cuando realizas una compra, el
              procesamiento del pago es gestionado integramente por MercadoPago.
              No almacenamos datos de tarjetas de credito ni informacion
              financiera sensible. Solo registramos el identificador de la
              transaccion y su estado.
            </li>
            <li>
              <strong>Datos tecnicos:</strong> tipo de dispositivo, navegador y
              suscripcion a notificaciones push (si la autorizas).
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-base font-bold text-text-primary mb-2">
            2. Como usamos tu informacion
          </h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Proveer y mantener el servicio de ArmatuProde.</li>
            <li>Procesar compras de coins y entradas a pozos de grupo.</li>
            <li>Enviar notificaciones push sobre partidos y actividad de grupos (si lo autorizas).</li>
            <li>Generar rankings y estadisticas dentro de los grupos.</li>
            <li>Mejorar la experiencia del usuario y corregir errores.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-base font-bold text-text-primary mb-2">
            3. Comparticion de datos
          </h2>
          <p>
            No vendemos ni compartimos tu informacion personal con terceros, excepto:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>
              <strong>MercadoPago:</strong> para procesar pagos. Consulta la{" "}
              <a
                href="https://www.mercadopago.com.ar/privacidad"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                politica de privacidad de MercadoPago
              </a>.
            </li>
            <li>
              <strong>Supabase:</strong> como proveedor de autenticacion e
              infraestructura. Los datos se almacenan de forma segura en sus
              servidores.
            </li>
            <li>
              <strong>Requerimientos legales:</strong> si la ley lo exige.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-base font-bold text-text-primary mb-2">
            4. Almacenamiento y seguridad
          </h2>
          <p>
            Tus datos se almacenan en servidores seguros. Utilizamos conexiones
            cifradas (HTTPS) y seguimos practicas estandar de seguridad para
            proteger tu informacion. Sin embargo, ningun sistema es 100% seguro
            y no podemos garantizar seguridad absoluta.
          </p>
        </section>

        <section>
          <h2 className="font-display text-base font-bold text-text-primary mb-2">
            5. Tus derechos
          </h2>
          <p>
            De acuerdo con la Ley 25.326 de Proteccion de Datos Personales de
            Argentina, tenes derecho a:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Acceder a tus datos personales.</li>
            <li>Solicitar la rectificacion de datos inexactos.</li>
            <li>Solicitar la supresion de tus datos.</li>
            <li>Oponerte al tratamiento de tus datos.</li>
          </ul>
          <p className="mt-2">
            Para ejercer estos derechos, contactanos a{" "}
            <a href="mailto:contacto@armatuprode.com.ar" className="text-primary underline">
              contacto@armatuprode.com.ar
            </a>.
          </p>
        </section>

        <section>
          <h2 className="font-display text-base font-bold text-text-primary mb-2">
            6. Cookies y tecnologias similares
          </h2>
          <p>
            Utilizamos cookies y almacenamiento local del navegador unicamente
            para mantener tu sesion iniciada y guardar preferencias. No
            utilizamos cookies de rastreo publicitario.
          </p>
        </section>

        <section>
          <h2 className="font-display text-base font-bold text-text-primary mb-2">
            7. Menores de edad
          </h2>
          <p>
            ArmatuProde no esta dirigido a menores de 18 anos. No recopilamos
            intencionalmente informacion de menores. Si descubrimos que un menor
            se registro, eliminaremos su cuenta.
          </p>
        </section>

        <section>
          <h2 className="font-display text-base font-bold text-text-primary mb-2">
            8. Cambios en esta politica
          </h2>
          <p>
            Podemos actualizar esta politica ocasionalmente. Te notificaremos
            sobre cambios significativos a traves de la aplicacion. El uso
            continuado del servicio implica la aceptacion de la politica vigente.
          </p>
        </section>

        <section>
          <h2 className="font-display text-base font-bold text-text-primary mb-2">
            9. Contacto
          </h2>
          <p>
            Si tenes preguntas sobre esta politica de privacidad, escribinos a{" "}
            <a href="mailto:contacto@armatuprode.com.ar" className="text-primary underline">
              contacto@armatuprode.com.ar
            </a>.
          </p>
        </section>
      </div>

      <div className="mt-12 pt-6 border-t border-border-default text-xs text-text-muted text-center">
        ArmatuProde &copy; {new Date().getFullYear()}
      </div>
    </div>
  );
}
