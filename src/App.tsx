/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, ChangeEvent } from 'react';
import { GoogleGenAI, GenerateContentResponse, Type } from '@google/genai';
import { Brain, Plus, Trash, Search } from 'lucide-react';
import { motion } from 'motion/react';

interface WordEntry {
  id: string;
  indonesian: string;
  myanmar: string;
  type: string;
}

interface SentenceHistory {
  id: string;
  indonesianSentence: string;
  myanmarTranslation: string;
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export default function App() {
  const [newWord, setNewWord] = useState('');
  const [wordBank, setWordBank] = useState<WordEntry[]>([]);
  const [filteredWordBank, setFilteredWordBank] = useState<WordEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sentenceHistory, setSentenceHistory] = useState<SentenceHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ai = useRef<GoogleGenAI | null>(null);

  useEffect(() => {
    if (GEMINI_API_KEY) {
      ai.current = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    } else {
      setError('Gemini API Key is not configured. Please check your .env.example and environment variables.');
    }

    // Load from localStorage
    const storedWords = localStorage.getItem('wordBank');
    if (storedWords) {
      setWordBank(JSON.parse(storedWords));
    }
    const storedSentences = localStorage.getItem('sentenceHistory');
    if (storedSentences) {
      setSentenceHistory(JSON.parse(storedSentences));
    }
  }, []);

  useEffect(() => {
    setFilteredWordBank(
      wordBank.filter(
        (word) =>
          word.indonesian.toLowerCase().includes(searchTerm.toLowerCase()) ||
          word.myanmar.toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [wordBank, searchTerm]);

  const saveWord = async () => {
    if (!newWord.trim() || !ai.current) return;
    setLoading(true);
    setError(null);

    try {
      const prompt = `Translate the Indonesian word \"${newWord}\" to Myanmar and detect its word type (Noun, Verb, Adjective, or Slang). Provide the output in JSON format with 'myanmarTranslation' and 'wordType' fields.`;
      const response: GenerateContentResponse = await ai.current.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              myanmarTranslation: { type: Type.STRING },
              wordType: { type: Type.STRING },
            },
            required: ['myanmarTranslation', 'wordType'],
          },
        },
      });

      const jsonStr = response.text.trim();
      const { myanmarTranslation, wordType } = JSON.parse(jsonStr);

      const entry: WordEntry = {
        id: Date.now().toString(),
        indonesian: newWord,
        myanmar: myanmarTranslation,
        type: wordType,
      };

      const updatedWordBank = [...wordBank, entry];
      setWordBank(updatedWordBank);
      localStorage.setItem('wordBank', JSON.stringify(updatedWordBank));
      setNewWord('');
    } catch (err) {
      console.error('Error saving word:', err);
      setError('Failed to save word. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const deleteWord = (id: string) => {
    const updatedWordBank = wordBank.filter((word) => word.id !== id);
    setWordBank(updatedWordBank);
    localStorage.setItem('wordBank', JSON.stringify(updatedWordBank));
  };

  const buildSentence = async () => {
    if (wordBank.length < 3 || !ai.current) {
      setError('Need at least 3 words in the word bank to build a sentence.');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const randomWords = [...wordBank].sort(() => 0.5 - Math.random()).slice(0, Math.min(5, wordBank.length));
      const indonesianWords = randomWords.map((w) => w.indonesian);

      const prompt = `Construct a grammatically correct sentence or question or phrase or clause or slang of Indonesian language using ONLY these words: ${indonesianWords.join(', ')}. Do NOT add any other words. Output in two lines. Line 1: Indonesian Sentence. Line 2: Myanmar Translation.`;

      const response: GenerateContentResponse = await ai.current.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ parts: [{ text: prompt }] }],
      });

      const [indonesianSentence, myanmarTranslation] = response.text.split('\n').map((s) => s.trim());

      const newSentence: SentenceHistory = {
        id: Date.now().toString(),
        indonesianSentence,
        myanmarTranslation,
      };

      const updatedSentenceHistory = [...sentenceHistory, newSentence];
      setSentenceHistory(updatedSentenceHistory);
      localStorage.setItem('sentenceHistory', JSON.stringify(updatedSentenceHistory));
    } catch (err) {
      console.error('Error building sentence:', err);
      setError('Failed to build sentence. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen p-8 flex flex-col items-center justify-center"
    >
      <h1 className="text-5xl font-bold mb-8 text-indigo-400">Smart Language Builder</h1>

      {error && <div className="bg-red-500 text-white p-4 rounded-md mb-4 w-full max-w-2xl">{error}</div>}

      {/* New Word Entry */}
      <div id="new-word-entry" className="bg-zinc-900 p-6 rounded-xl shadow-lg mb-8 w-full max-w-2xl">
        <h2 className="text-2xl font-semibold mb-4 flex items-center">
          <Plus className="mr-2" /> New Word Entry
        </h2>
        <div className="flex space-x-4">
          <input
            type="text"
            className="flex-grow p-3 rounded-md bg-zinc-800 border border-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Enter Indonesian word..."
            value={newWord}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setNewWord(e.target.value)}
            disabled={loading}
          />
          <button
            onClick={saveWord}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-md transition-colors duration-200 flex items-center"
            disabled={loading}
          >
            {loading ? 'Saving...' : <><Brain className="mr-2" /> Save</>}
          </button>
        </div>
      </div>

      {/* Word Bank */}
      <div id="word-bank" className="bg-zinc-900 p-6 rounded-xl shadow-lg mb-8 w-full max-w-2xl">
        <h2 className="text-2xl font-semibold mb-4 flex items-center">
          <Search className="mr-2" /> Word Bank
        </h2>
        <input
          type="text"
          className="w-full p-3 rounded-md bg-zinc-800 border border-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4"
          placeholder="Search words..."
          value={searchTerm}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
        />
        <div className="max-h-60 overflow-y-auto custom-scrollbar">
          {filteredWordBank.length === 0 ? (
            <p className="text-zinc-500">No words saved yet. Add some above!</p>
          ) : (
            <ul className="space-y-2">
              {filteredWordBank.map((word) => (
                <li key={word.id} className="flex items-center justify-between bg-zinc-800 p-3 rounded-md border border-zinc-700">
                  <div>
                    <p className="font-semibold text-lg">{word.indonesian} <span className="text-zinc-400 text-sm">({word.type})</span></p>
                    <p className="text-zinc-300">{word.myanmar}</p>
                  </div>
                  <button
                    onClick={() => deleteWord(word.id)}
                    className="text-red-400 hover:text-red-500 transition-colors duration-200"
                  >
                    <Trash size={20} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* AI Sentence Builder */}
      <div id="ai-sentence-builder" className="bg-zinc-900 p-6 rounded-xl shadow-lg mb-8 w-full max-w-2xl">
        <h2 className="text-2xl font-semibold mb-4 flex items-center">
          <Brain className="mr-2" /> AI Sentence Builder
        </h2>
        <button
          onClick={buildSentence}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-md transition-colors duration-200 w-full flex items-center justify-center"
          disabled={loading || wordBank.length < 3}
        >
          {loading ? 'Building...' : 'Create Sentence'}
        </button>
        {sentenceHistory.length > 0 && (
          <div className="mt-6 max-h-60 overflow-y-auto custom-scrollbar">
            <h3 className="text-xl font-semibold mb-3">History</h3>
            <ul className="space-y-3">
              {sentenceHistory.map((sentence) => (
                <li key={sentence.id} className="bg-zinc-800 p-4 rounded-md border border-zinc-700">
                  <p className="font-semibold text-lg mb-1">{sentence.indonesianSentence}</p>
                  <p className="text-zinc-300">{sentence.myanmarTranslation}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="text-zinc-500 text-sm mt-8">
        v1.0.1
      </footer>
    </motion.div>
  );
}
