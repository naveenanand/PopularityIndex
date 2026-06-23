'use client';

import { useRouter } from 'next/navigation';
import { useRef } from 'react';

interface Props {
  defaultValue?: string;
  placeholder?: string;
}

export function SearchBar({ defaultValue, placeholder = 'Search people...' }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = inputRef.current?.value?.trim();
    if (q) router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        ref={inputRef}
        name="q"
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      <button
        type="submit"
        className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors"
      >
        Search
      </button>
    </form>
  );
}
