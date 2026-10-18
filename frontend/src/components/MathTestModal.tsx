import React, { useState, useEffect } from 'react';
import { runGeometryEngineTests, TestCaseResult } from '../utils/geometry';
import { CheckCircle2, XCircle, RotateCcw, X, Calculator, ShieldCheck } from 'lucide-react';

interface MathTestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MathTestModal: React.FC<MathTestModalProps> = ({ isOpen, onClose }) => {
  const [testResults, setTestResults] = useState<{
    allPassed: boolean;
    totalTests: number;
    passedTests: number;
    results: TestCaseResult[];
  } | null>(null);

  const [isRunning, setIsRunning] = useState<boolean>(false);

  const runTests = () => {
    setIsRunning(true);
    setTimeout(() => {
      const outcome = runGeometryEngineTests();
      setTestResults(outcome);
      setIsRunning(false);
    }, 120);
  };

  useEffect(() => {
    if (isOpen) {
      runTests();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-2xl rounded-2xl border border-[#DCD0BD] bg-[#FFFDF8] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#DCD0BD] bg-[#EEE4D2]/40">
          <div className="flex items-center gap-2">
            <Calculator size={18} className="text-[#79583A]" />
            <h3 className="font-bold text-base text-[#302A23]">
              Mathematical Centimeter Engine — Live QA Unit Tests
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#746A5C] hover:bg-[#EEE4D2] hover:text-[#302A23] transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Status Banner */}
        <div className="px-5 py-3 border-b border-[#DCD0BD] bg-[#FFFDF8] flex items-center justify-between">
          <div className="flex items-center gap-2">
            {testResults?.allPassed ? (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#2F7657]/15 text-[#2F7657]">
                <ShieldCheck size={14} /> All {testResults.totalTests} Deterministic Tests Passed (100%)
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#B44343]/15 text-[#B44343]">
                <XCircle size={14} /> Tests Incomplete or Failing
              </span>
            )}
            <span className="text-xs text-[#746A5C]">Deterministic centimeter arithmetic verified</span>
          </div>

          <button
            onClick={runTests}
            disabled={isRunning}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#DCD0BD] text-xs font-semibold text-[#302A23] hover:bg-[#EEE4D2] transition disabled:opacity-50"
          >
            <RotateCcw size={12} className={isRunning ? 'animate-spin' : ''} />
            <span>Rerun Suite</span>
          </button>
        </div>

        {/* Test List Content */}
        <div className="p-5 overflow-y-auto space-y-3 divide-y divide-[#DCD0BD]/60">
          {testResults?.results.map((res, idx) => (
            <div key={idx} className={idx > 0 ? 'pt-3' : ''}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  {res.passed ? (
                    <CheckCircle2 size={16} className="text-[#2F7657] mt-0.5 shrink-0" />
                  ) : (
                    <XCircle size={16} className="text-[#B44343] mt-0.5 shrink-0" />
                  )}
                  <div>
                    <h5 className="font-semibold text-xs text-[#302A23]">{res.name}</h5>
                    <div className="text-[11px] text-[#746A5C] mt-1 space-y-0.5 font-mono">
                      <div>
                        Expected: <span className="text-[#302A23]">{res.expected}</span>
                      </div>
                      <div>
                        Calculated: <span className={res.passed ? 'text-[#2F7657] font-semibold' : 'text-[#B44343]'}>{res.actual}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                    res.passed ? 'bg-[#2F7657]/10 text-[#2F7657]' : 'bg-[#B44343]/10 text-[#B44343]'
                  }`}
                >
                  {res.passed ? 'PASS' : 'FAIL'}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-[#DCD0BD] bg-[#EEE4D2]/40 flex items-center justify-between text-xs text-[#746A5C]">
          <span>Gauss Shoelace Centimeter Area • Rotating Calipers OBB • Euclidean Edge Sum • Volumetric Shape Factors (cm³)</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#79583A] text-white font-semibold hover:bg-[#61442B] transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
