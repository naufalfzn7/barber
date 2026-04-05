"use client";

type PaymentSuccessModalProps = {
  isOpen: boolean;
  title: string;
  description: string;
  amountLabel?: string;
  buttonLabel?: string;
  onClose: () => void;
};

export default function PaymentSuccessModal({
  isOpen,
  title,
  description,
  amountLabel,
  buttonLabel = "Lanjut",
  onClose,
}: PaymentSuccessModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/55 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-emerald-100 p-6 shadow-xl">
        <div className="relative flex items-center justify-center mb-5 h-28">
          <div className="absolute w-24 h-24 rounded-full bg-emerald-100 animate-ping opacity-50" />
          <div className="absolute w-16 h-16 rounded-full bg-emerald-200 animate-pulse" />
          <div className="relative z-10 w-14 h-14 rounded-full bg-emerald-500 text-white flex items-center justify-center text-2xl font-bold">
            ✓
          </div>

          <span className="absolute left-8 top-4 text-amber-400 text-lg animate-bounce">
            ✦
          </span>
          <span className="absolute right-8 top-7 text-sky-400 text-base animate-bounce [animation-delay:120ms]">
            ✦
          </span>
          <span className="absolute left-12 bottom-4 text-rose-400 text-base animate-bounce [animation-delay:240ms]">
            ✦
          </span>
          <span className="absolute right-12 bottom-3 text-violet-400 text-lg animate-bounce [animation-delay:360ms]">
            ✦
          </span>
        </div>

        <div className="text-center space-y-2">
          <p className="text-base font-bold text-gray-900">{title}</p>
          <p className="text-sm text-gray-600">{description}</p>
          {amountLabel && (
            <p className="text-sm font-semibold text-emerald-700">
              {amountLabel}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-lg py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors"
        >
          {buttonLabel}
        </button>
      </div>
    </div>
  );
}
