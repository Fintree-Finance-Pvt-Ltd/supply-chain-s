import { useState } from "react";
import LoadingSpinner from "../../../../components/LoadingSpinner";

const SubmitModal = ({ submissionTargets, setSubmissionTargets, onConfirm, disabled }) => {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedCsv = Object.keys(submissionTargets)
    .filter((k) => submissionTargets[k].selected)
    .join(",");

  const canSubmit = selectedCsv.length > 0;

  const confirm = async () => {
    try {
      setIsSubmitting(true);
      await onConfirm(selectedCsv);
      setOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="btn-primary"
      >
        Submit Case
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Push Case to Entities</h2>
              <p className="text-sm text-gray-500 mt-1">Select entities to submit.</p>
            </div>

            <div className="space-y-4">
              {Object.keys(submissionTargets).map((target) => (
                <div key={target} className="border border-gray-100 rounded-lg p-4 bg-gray-50">
                  <label className="flex items-center gap-3 cursor-pointer mb-3">
                    <input
                      type="checkbox"
                      checked={submissionTargets[target].selected}
                      onChange={(e) =>
                        setSubmissionTargets({
                          ...submissionTargets,
                          [target]: { ...submissionTargets[target], selected: e.target.checked },
                        })
                      }
                      className="rounded h-5 w-5 text-primary-600"
                    />
                    <span className="font-bold text-gray-800">{target.toUpperCase()}</span>
                  </label>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setOpen(false)} className="flex-1 btn-secondary" disabled={isSubmitting}>
                Cancel
              </button>
              <button
                onClick={confirm}
                className="flex-1 btn-primary"
                disabled={isSubmitting || !canSubmit}
              >
                {isSubmitting ? <LoadingSpinner size="sm" /> : "Confirm & Submit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SubmitModal;
