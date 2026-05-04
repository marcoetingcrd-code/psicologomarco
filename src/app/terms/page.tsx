export const metadata = { title: "Termini — Atlas" };

export default function TermsPage() {
  return (
    <div className="min-h-screen max-w-2xl mx-auto px-4 py-10 text-zinc-300 leading-relaxed">
      <h1 className="text-3xl font-semibold mb-6 text-white">Termini di servizio</h1>
      <p className="text-xs text-zinc-500 mb-8">Ultimo aggiornamento: {new Date().toLocaleDateString("it-IT")}</p>

      <section className="space-y-4 mb-8">
        <h2 className="text-xl font-medium text-white">Cos&apos;è Atlas</h2>
        <p>
          Atlas è un assistente conversazionale basato su AI che risponde a domande, propone
          strategie e offre spunti di riflessione. <strong>Non è un servizio medico, psicologico
          o legale.</strong> Non sostituisce il parere di professionisti qualificati.
        </p>
      </section>

      <section className="space-y-4 mb-8">
        <h2 className="text-xl font-medium text-white">Uso accettabile</h2>
        <p>Usando Atlas ti impegni a non:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Caricare contenuti illegali, violenti, sessualmente espliciti verso minori</li>
          <li>Tentare di aggirare la sicurezza o eseguire scraping massivo</li>
          <li>Usare l&apos;app per prendere decisioni mediche, legali o finanziarie critiche</li>
          <li>Condividere le tue credenziali con terzi</li>
        </ul>
      </section>

      <section className="space-y-4 mb-8">
        <h2 className="text-xl font-medium text-white">Limitazione di responsabilità</h2>
        <p>
          Le risposte di Atlas sono generate da un sistema automatico e possono contenere errori
          o omissioni. Usa il tuo giudizio critico. Il titolare non è responsabile per danni
          diretti o indiretti derivanti dall&apos;uso dell&apos;app.
        </p>
      </section>

      <section className="space-y-4 mb-8">
        <h2 className="text-xl font-medium text-white">Il tuo account</h2>
        <p>
          Puoi cancellare il tuo account in qualunque momento dalle impostazioni. La cancellazione
          elimina tutte le tue conversazioni in modo irreversibile. Possiamo sospendere account
          che violano questi termini.
        </p>
      </section>

      <section className="space-y-4 mb-8">
        <h2 className="text-xl font-medium text-white">Modifiche</h2>
        <p>
          Possiamo aggiornare questi termini. Ti avvisiamo via email con almeno 30 giorni di
          preavviso per cambiamenti sostanziali.
        </p>
      </section>

      <section className="space-y-4 mb-8">
        <h2 className="text-xl font-medium text-white">Legge applicabile</h2>
        <p>
          Questi termini sono regolati dalla legge italiana. Foro competente: tribunale del luogo
          di residenza del consumatore ove applicabile.
        </p>
      </section>

      <div className="mt-10 pt-6 border-t border-zinc-800">
        <a href="/" className="text-sm text-indigo-400 hover:text-indigo-300">
          ← Torna all&apos;app
        </a>
      </div>
    </div>
  );
}
