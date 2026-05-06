import { Pause, Play, RotateCcw, SkipForward } from "lucide-react";

export function TimerControls({
  isRunning,
  onStart,
  onPause,
  onReset,
  onNext,
}: {
  isRunning: boolean;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onNext: () => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {isRunning ? (
        <button type="button" className="btn-primary min-h-12" onClick={onPause}>
          <Pause size={18} />
          일시정지
        </button>
      ) : (
        <button type="button" className="btn-primary min-h-12" onClick={onStart}>
          <Play size={18} />
          시작 / 재개
        </button>
      )}
      <button type="button" className="btn-secondary min-h-12" onClick={onReset}>
        <RotateCcw size={18} />
        초기화
      </button>
      <button type="button" className="btn-secondary min-h-12" onClick={onNext}>
        <SkipForward size={18} />
        다음 모드
      </button>
    </div>
  );
}
