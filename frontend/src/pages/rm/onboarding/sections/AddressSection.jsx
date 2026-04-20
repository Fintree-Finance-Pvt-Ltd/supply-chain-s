import { FiPlus } from "react-icons/fi";
import AddressForm from "../../../../components/AddressForm";

const AddressSection = ({ addresses, setAddresses, errors }) => {
  const add = () => {
    const localKey = Date.now();
    setAddresses((p) => [
      ...p,
      {
        id: null,
        localKey,
        type: "",
        fullAddress: "",
        pincode: "",
        state: "",
        city: "",
      },
    ]);
  };

  const update = (key, patch) => {
    setAddresses((p) =>
      p.map((x) =>
        x.id === key || x.localKey === key ? { ...x, ...patch } : x
      )
    );
  };

  const remove = (key) => {
    setAddresses((p) =>
      p.filter((x) => x.id !== key && x.localKey !== key)
    );
  };

  return (
    <div className="border-t border-gray-200 pt-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Address Details
        </h3>
        <button
          type="button"
          onClick={add}
          className="btn-secondary flex items-center gap-2"
        >
          <FiPlus className="h-4 w-4" />
          Add Address
        </button>
      </div>

      {/* ✅ GLOBAL ERROR */}
      {errors?.addresses && (
        <div className="mb-3 p-2 bg-red-50 border border-red-300 rounded text-red-600 text-sm">
          {errors.addresses}
        </div>
      )}

      {addresses.length === 0 ? (
        <p className="text-gray-500 text-sm">
          No addresses added yet
        </p>
      ) : (
        <div className="space-y-4">
          {addresses.map((addr, index) => (
            <div
              key={addr.id || addr.localKey}
              className="border rounded p-3"
            >
              {/* ✅ ROW LEVEL ERROR (optional but useful) */}
              {(errors[`addr_${index}_type`] ||
                errors[`addr_${index}_address`] ||
                errors[`addr_${index}_pincode`] ||
                errors[`addr_${index}_state`] ||
                errors[`addr_${index}_city`]) && (
                <p className="text-red-500 text-sm mb-2">
                  Please fill all required address fields
                </p>
              )}

              <AddressForm
                index={index}
                data={addr}
                onChange={(key, data) =>
                  update(addr.id || addr.localKey, data)
                }
                onRemove={() =>
                  remove(addr.id || addr.localKey)
                }
                readOnly={false}
                errors={{
                  type: errors[`addr_${index}_type`],
                  fullAddress: errors[`addr_${index}_address`],
                  pincode: errors[`addr_${index}_pincode`],
                  state: errors[`addr_${index}_state`],
                  city: errors[`addr_${index}_city`],
                }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AddressSection;