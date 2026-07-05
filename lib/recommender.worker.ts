import { recommend, type RecommenderInput } from './recommender';

// The recommender runs off the main thread (white paper §X). Pure in, pure out.
self.onmessage = (e: MessageEvent<RecommenderInput>) => {
  self.postMessage(recommend(e.data));
};
