import { FiPlus } from "react-icons/fi";
import ContactPersonForm from "../../../../components/ContactPersonForm";

const ContactPersonSection = ({ contactPersons, setContactPersons, errors }) => {
  const add = () => {
    const localKey = Date.now();
    setContactPersons((p) => [...p, { id: null, localKey, name: "", mobile: "", email: "", designation: "", gender: "" }]);
  };

  const update = (key, patch) => {
    setContactPersons((p) => p.map((x) => (x.id === key || x.localKey === key ? { ...x, ...patch } : x)));
  };

  const remove = (key) => {
    setContactPersons((p) => p.filter((x) => x.id !== key && x.localKey !== key));
  };

  return (
    <div className="border-t border-gray-200 pt-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Contact Person Details</h3>
        <button type="button" onClick={add} className="btn-secondary flex items-center gap-2">
          <FiPlus className="h-4 w-4" />
          Add Contact Person
        </button>
      </div>

      {contactPersons.length === 0 ? (
        <p className="text-gray-500 text-sm">No contact persons added yet</p>
      ) : (
        <div className="space-y-4">
          {contactPersons.map((cp, index) => (
            <ContactPersonForm
              key={cp.id || cp.localKey}
              index={index}
              data={cp}
              onChange={(key, data) => update(cp.id || cp.localKey, data)}
              onRemove={() => remove(cp.id || cp.localKey)}
              errors={{
                name: errors[`cp_${index}_name`],
                mobile: errors[`cp_${index}_mobile`],
                email: errors[`cp_${index}_email`],
                gender: errors[`cp_${index}_gender`],
              }}
              readOnly={false}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ContactPersonSection;
