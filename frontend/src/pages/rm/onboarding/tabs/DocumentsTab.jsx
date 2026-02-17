import DocumentChecklistUploader from "../../../../components/DocumentChecklistUploader";

const DocumentsTab = ({ checklist, uploadedDocuments, customerId, onDocumentUploaded, onDocumentRemoved }) => {
  return (
    <DocumentChecklistUploader
      checklist={checklist}
      uploadedDocuments={uploadedDocuments}
      customerId={customerId}
      onDocumentUploaded={onDocumentUploaded}
      onDocumentRemoved={onDocumentRemoved}
    />
  );
};

export default DocumentsTab;
