import { FiPlus } from "react-icons/fi";
import CoApplicantForm from "../../../../components/CoApplicantForm";

const CoApplicantSection = ({
  customerId,
  coApplicants,
  setCoApplicants,
  coApplicantKyc,
  setCoApplicantKyc,
  onVerify,
  verificationStatuses,
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
            const vs =
  coApp.id
    ? verificationStatuses.find((s) => s.coApplicantId === coApp.id) || {}
    : {};


            return (
              <CoApplicantForm
                key={key}
                index={idx}
                data={coApp}
                onChange={(i, data) => updateCoApplicant(key, data)}
                onRemove={() => removeCoApplicant(key)}
                onPanUpload={(index, file, panNumber) => handleCoApplicantPanUpload(key, file, panNumber)}
                kycData={coApplicantKyc[key] || {}}
                customerId={customerId}
                onVerify={onVerify}
                loadingStates={{}} // optional: extend if you want per-field loading
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
