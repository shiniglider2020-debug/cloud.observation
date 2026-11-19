import { Plus } from 'lucide-react';
import { ETAGES, WMO_GENERA } from '../data/wmoTaxonomy';
import type { GenusCode } from '../types/cloud';

interface WmoTaxonomyViewProps {
  onLogGenus: (code: GenusCode) => void;
}

export function WmoTaxonomyView({ onLogGenus }: WmoTaxonomyViewProps) {
  const activeEtages = ETAGES.filter((e) => e !== 'Unclassified');

  return (
    <div className="space-y-8">
      <div className="border-b border-slate-200 pb-4">
        <h2 className="font-display text-lg font-bold text-slate-900">
          WMO International Cloud Atlas Taxonomy
        </h2>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          Standardized ten-genus classification organized by tropospheric étage. Select any genus below to log a new observation pre-populated with its atmospheric level.
        </p>
      </div>

      {activeEtages.map((etage) => {
        const genera = WMO_GENERA.filter((g) => g.etage === etage);
        if (genera.length === 0) return null;

        return (
          <section key={etage} className="space-y-3">
            <h3 className="font-mono text-xs font-semibold tracking-wider text-slate-500">
              {etage}
            </h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {genera.map((genus) => (
                <article
                  key={genus.code}
                  className="flex flex-col justify-between rounded-lg border border-slate-200 bg-white p-5"
                >
                  <div>
                    <div className="flex items-baseline justify-between gap-2">
                      <h4 className="font-display text-base font-bold text-slate-900">
                        {genus.latinName}
                      </h4>
                      <span className="font-mono text-sm font-semibold text-sky-700">
                        {genus.code}
                      </span>
                    </div>

                    <div className="mt-1 flex items-center gap-2 font-mono text-[11px] text-slate-500">
                      <span>{genus.altitudeRange}</span>
                      <span aria-hidden="true">·</span>
                      <span>{genus.composition}</span>
                    </div>

                    <p className="mt-3 text-xs leading-relaxed text-slate-700">
                      {genus.visualSignature}
                    </p>

                    <div className="mt-3 border-t border-slate-100 pt-3">
                      <div className="text-[11px] font-medium text-slate-400">
                        Formative Mechanism
                      </div>
                      <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
                        {genus.mechanism}
                      </p>
                    </div>

                    <div className="mt-3 border-t border-slate-100 pt-3">
                      <div className="text-[11px] font-medium text-slate-400">
                        Common Species &amp; Varieties
                      </div>
                      <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
                        {genus.commonSpeciesVarieties.join(', ')}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 pt-2">
                    <button
                      type="button"
                      onClick={() => onLogGenus(genus.code)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-sky-600 hover:text-sky-700"
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                      Log {genus.code} Specimen
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
