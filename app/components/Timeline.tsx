import { Line } from 'react-chartjs-2';
import { AlertCircle, TrendingUp } from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ChartOptions
} from 'chart.js';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface TimelineProps {
  scoreHistory: {
    date: string;
    score: number;
  }[];
  hasCredentials: boolean;
}

export function Timeline({ scoreHistory, hasCredentials }: TimelineProps) {
  if (!hasCredentials) {
    return (
      <div className="bg-white/5 border border-gray-800 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 rounded-lg bg-yellow-500/10">
            <AlertCircle className="w-4 h-4 text-yellow-400" />
          </div>
          <h2 className="text-lg font-semibold text-white">Risk Score Timeline</h2>
        </div>
        <div className="text-center text-gray-400 py-8">
          Connect a provider to view risk score history
        </div>
      </div>
    );
  }

  // Prepare data for the chart
  const data = {
    labels: scoreHistory.map(item => new Date(item.date).toLocaleDateString()),
    datasets: [
      {
        label: 'Risk Score',
        data: scoreHistory.map(item => item.score),
        borderColor: 'rgb(99, 102, 241)',
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: (context: any) => {
          const score = context.raw;
          if (score <= 4) return 'rgb(34, 197, 94)'; // green
          if (score <= 9) return 'rgb(234, 179, 8)'; // yellow
          if (score <= 14) return 'rgb(249, 115, 22)'; // orange
          return 'rgb(239, 68, 68)'; // red
        },
      },
    ],
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const score = context.raw;
            let riskLevel = 'Low Risk';
            if (score <= 4) riskLevel = 'Low Risk';
            else if (score <= 9) riskLevel = 'Medium Risk';
            else if (score <= 14) riskLevel = 'High Risk';
            else riskLevel = 'Critical Risk';
            return `Score: ${score} (${riskLevel})`;
          },
        },
      },
    },
    scales: {
      y: {
        type: 'linear' as const,
        min: 0,
        max: 15,
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
        },
        ticks: {
          color: 'rgba(255, 255, 255, 0.5)',
          callback: function(value) {
            if (typeof value === 'number') {
              if (value === 0) return 'Low';
              if (value === 5) return 'Medium';
              if (value === 10) return 'High';
              if (value === 15) return 'Critical';
            }
            return '';
          },
        },
      },
      x: {
        type: 'category' as const,
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
        },
        ticks: {
          color: 'rgba(255, 255, 255, 0.5)',
          maxRotation: 45,
          minRotation: 45,
        },
      },
    },
  };

  return (
    <div className="bg-white/5 border border-gray-800 rounded-xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 rounded-lg bg-blue-500/10">
          <TrendingUp className="w-4 h-4 text-blue-400" />
        </div>
        <h2 className="text-lg font-semibold text-white">Risk Score Timeline</h2>
      </div>
      <div className="h-[300px]">
        <Line data={data} options={options} />
      </div>
      <div className="mt-4 flex justify-center gap-4 text-xs text-gray-400">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span>Low (≤4)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-yellow-500" />
          <span>Medium (5-9)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-orange-500" />
          <span>High (10-14)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <span>Critical ({'>'}14)</span>
        </div>
      </div>
    </div>
  );
} 