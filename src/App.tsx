import PhrasesPage from './features/phrases/PhrasesPage';

export default function App() {
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="mb-6 text-xl font-semibold text-slate-800">Phrasebook</h1>
      <PhrasesPage />
    </div>
  );
}
