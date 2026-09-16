import { useRef, useState, type DragEvent } from "react";

interface Props {
  onFiles: (files: FileList) => void;
}

export default function FileDrop({ onFiles }: Props) {
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const stop = (e: DragEvent) => e.preventDefault();

  return (
    <div
      className={`drop${over ? " over" : ""}`}
      onClick={() => inputRef.current?.click()}
      onDragEnter={(e) => {
        stop(e);
        setOver(true);
      }}
      onDragOver={stop}
      onDragLeave={(e) => {
        stop(e);
        setOver(false);
      }}
      onDrop={(e) => {
        stop(e);
        setOver(false);
        if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files);
      }}
    >
      Przeciągnij tu pliki XML pobrane z KSeF (można wiele naraz) albo kliknij, aby wybrać
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".xml,text/xml,application/xml"
        onChange={(e) => {
          if (e.target.files?.length) onFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
