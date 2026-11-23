import { LEGAL_VERSION } from "../../../../lib/constants";

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-12">
      <p className="text-sm text-muted">Borrador {LEGAL_VERSION}. No es asesoramiento legal.</p>
      <h1 className="mt-3 font-display text-4xl">Términos</h1>
      <div className="mt-6 space-y-4 text-sm leading-6">
        <p>
          influencers_crm es una herramienta para que creators lleven sus acuerdos con marcas. En esta beta no se emiten
          facturas ni se procesan pagos de las marcas.
        </p>
        <p>
          Quien carga contactos de marcas es responsable de esos datos. El producto los usa solo dentro del workspace.
        </p>
        <p>La versión aceptada en el registro queda guardada con fecha.</p>
      </div>
    </main>
  );
}
