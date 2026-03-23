import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  component: HomePage,
});

function HomePage() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-3xl font-bold text-gray-900">
        UK Income Tax Calculator
      </h1>
      <p className="mt-2 text-gray-600">2025/26 Tax Year</p>
    </div>
  );
}
