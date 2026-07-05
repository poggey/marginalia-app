import { AXES, AXIS_LABELS, type Axis, type Book } from '@/lib/types';
import type { Prediction } from './predict';
import { DELTA_STOPS } from './constants';

// §2: reasoning strings are generated from real intermediate values — top
// neighbours, top sensitivity-weighted axis matches, drift distance. Template-
// based, never hand-waved: every number in a sentence exists in the pipeline.

function axisName(a: Axis): string {
  return AXIS_LABELS[a].toLowerCase();
}

function fmt(n: number): string {
  return n.toFixed(2);
}

export interface ReasoningInput {
  book: Book;
  prediction: Prediction | null;
  nov: number;
  delta: number;
  tasteAxes: Record<Axis, number> | null;
  sensitivities: Record<Axis, number> | null;
  wildcard: boolean;
  ratedCount: number;
}

export function buildReasoning(input: ReasoningInput): string[] {
  const { book, prediction, nov, delta, tasteAxes, sensitivities, wildcard, ratedCount } = input;
  const sentences: string[] = [];

  if (wildcard) {
    sentences.push(
      `The wildcard: the least familiar book that passed your filters — novelty ${fmt(nov)} against everything you have read. Your filters applied; your taste didn't.`,
    );
  }

  if (prediction && prediction.neighbours.length > 0 && !wildcard) {
    const [n1, n2] = prediction.neighbours;
    if (n2) {
      sentences.push(
        `Closest to ${n1.title} (similarity ${fmt(n1.sim)}, which you rated ${n1.verdict.toFixed(1)}) and ${n2.title} (${fmt(n2.sim)}, rated ${n2.verdict.toFixed(1)}).`,
      );
    } else {
      sentences.push(
        `Nearest to ${n1.title} (similarity ${fmt(n1.sim)}), which you rated ${n1.verdict.toFixed(1)}.`,
      );
    }
  }

  if (tasteAxes) {
    // Axes where the book and your loved books both run high — ranked by
    // sensitivity when the regression exists, by joint strength otherwise.
    const scored = AXES.map((a) => ({
      axis: a,
      strength: sensitivities
        ? Math.abs(sensitivities[a]) * (1 - Math.abs(book.axes[a] - tasteAxes[a]))
        : book.axes[a] * tasteAxes[a],
      gap: book.axes[a] - tasteAxes[a],
    })).sort((x, y) => y.strength - x.strength);
    const [t1, t2] = scored;
    const qualifier = sensitivities ? ', your highest-sensitivity axes' : ' — axes your favourites run high on';
    sentences.push(
      `Strongest on ${axisName(t1.axis)} (${fmt(book.axes[t1.axis])}) and ${axisName(t2.axis)} (${fmt(
        book.axes[t2.axis],
      )})${qualifier}.`,
    );

    const divergence = AXES.map((a) => ({ axis: a, gap: book.axes[a] - tasteAxes[a] })).sort(
      (x, y) => Math.abs(y.gap) - Math.abs(x.gap),
    )[0];
    if (Math.abs(divergence.gap) >= 0.2 && !wildcard) {
      const dir = divergence.gap > 0 ? 'further into' : 'lighter on';
      sentences.push(
        `It runs ${dir} ${axisName(divergence.axis)} than your usual — ${fmt(
          book.axes[divergence.axis],
        )} against your centre of ${fmt(tasteAxes[divergence.axis])}.`,
      );
    }
  }

  if (delta >= 0.25 && !wildcard) {
    const stop = [...DELTA_STOPS].reverse().find((s) => delta >= s.delta) ?? DELTA_STOPS[0];
    sentences.push(
      `Surfaced at ${stop.name} (δ ${delta.toFixed(2)}): novelty ${fmt(nov)} against your read shelf.`,
    );
  }

  if (ratedCount > 0 && ratedCount < 10 && !wildcard) {
    sentences.push(
      `Early days — only ${ratedCount} rating${ratedCount === 1 ? '' : 's'} behind this, so the band is honest about its width.`,
    );
  }

  return sentences.slice(0, wildcard ? 2 : 4);
}
