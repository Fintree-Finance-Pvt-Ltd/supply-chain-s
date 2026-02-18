import { FiPlus } from "react-icons/fi";
import CoApplicantForm from "../../../../components/CoApplicantForm";
import { documentService } from "../../../../services/documentService";

const CoApplicantSection = ({
  customerId,
  coApplicants,
  setCoApplicants,
  coApplicantKyc,
  setCoApplicantKyc,
  onVerify,
  verificationStatuses,
  loadingStates,
  errors,
}) => {
  const addCoApplicant = () => {
    const localKey = Date.now();
    setCoApplicants((p) => [...p, { id: null, localKey, name: "", mobile: "", email: "", gender: "" }]);
  };

  const removeCoApplicant = (key) => {
    setCoApplicants((p) => p.filter((x) => x.id !== key && x.localKey !== key));
    setCoApplicantKyc((p) => {
      const next = { ...p };
      delete next[key];
      return next;
    });
  };

  const updateCoApplicant = (key, patch) => {
    setCoApplicants((p) =>
      p.map((x) => (x.id === key || x.localKey === key ? { ...x, ...patch } : x))
    );
  };

  const handleCoApplicantPanUpload = (key, file, panNumber) => {
    setCoApplicantKyc((p) => ({
      ...p,
      [key]: { ...(p[key] || {}), panFile: file, panNumber },
    }));

    // If we already have a saved co-applicant and customerId, upload immediately
    try {
      const coApp = coApplicants.find((c) => (c.id || c.localKey) === key);
      const coAppId = coApp?.id;

      if (customerId && coAppId && file) {
        // upload document to server for this co-applicant
        documentService.uploadDocument(customerId, file, 'pan', 'co-applicant', 1, coAppId)
          .then(() => {
            // optional: you may refresh documents in parent if needed
            console.log('Co-applicant PAN uploaded for coApplicantId', coAppId);
          })
          .catch((err) => {
            console.error('Co-applicant PAN upload failed', err);
          });
      }
    } catch (e) {
      console.error('Co-applicant immediate upload error', e);
    }
  };

  return (
    <div className="border-t pt-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-gray-900">Co-Applicants / Co-Borrowers</h3>
        <button type="button" onClick={addCoApplicant} className="btn-secondary flex items-center gap-2">
          <FiPlus className="h-4 w-4" />
          Add Co-Applicant
        </button>
      </div>

      {errors.coApplicants && <p className="text-red-500 text-xs mb-2">{errors.coApplicants}</p>}

      {coApplicants.length === 0 ? (
        <p className="text-gray-500 text-sm italic">No co-applicants added yet</p>
      ) : (
        <div className="space-y-6">
          {coApplicants.map((coApp, idx) => {
            const key = coApp.id || coApp.localKey;
            const vs = coApp.id ? verificationStatuses[coApp.id] || {} : {};



            return (
              <CoApplicantForm
                key={key}
                index={idx}
                data={coApp}
                onChange={(i, data) => updateCoApplicant(key, data)}
                onRemove={() => removeCoApplicant(key)}
                onPanUpload={(index, file, panNumber) => handleCoApplicantPanUpload(key, file, panNumber)}
                onKycUpdate={(patch) => setCoApplicantKyc(p => ({ ...p, [key]: { ...(p[key] || {}), ...patch } }))}
                kycData={coApplicantKyc[key] || {}}
                customerId={customerId}
                onVerify={onVerify}
                loadingStates={loadingStates} // optional: extend if you want per-field loading
                verificationStatus={vs}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CoApplicantSection;
