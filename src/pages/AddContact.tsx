import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { collection, addDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Send, Upload, FileText, X } from "lucide-react";
import { toast } from "sonner";

const AddContact = () => {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      if (selected.size > 10 * 1024 * 1024) {
        toast.error("Arquivo muito grande! Máximo 10MB.");
        return;
      }
      setFile(selected);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone) {
      toast.error("Preencha nome e número!");
      return;
    }

    setLoading(true);
    try {
      let documentUrl = "";
      let documentName = "";

      if (file) {
        const storageRef = ref(storage, `documents/${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, file);
        documentUrl = await getDownloadURL(storageRef);
        documentName = file.name;
      }

      await addDoc(collection(db, "contacts"), {
        name,
        phone,
        description,
        documentUrl,
        documentName,
        createdAt: new Date().toISOString(),
      });
      toast.success("Contato salvo com sucesso!");
      navigate("/");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao salvar. Verifique a configuração do Firebase.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="mx-auto max-w-md">
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="mb-4 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-bold">Novo Contato</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  placeholder="Nome do contato"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-secondary/50"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Número do WhatsApp</Label>
                <Input
                  id="phone"
                  placeholder="+55 11 99999-9999"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="bg-secondary/50"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  placeholder="Descrição do contato..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="bg-secondary/50"
                />
              </div>

              {/* File Upload */}
              <div className="space-y-2">
                <Label>Documento (opcional)</Label>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.txt"
                />
                {file ? (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
                    <FileText className="h-5 w-5 text-primary shrink-0" />
                    <span className="text-sm text-foreground truncate flex-1">
                      {file.name}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      onClick={() => setFile(null)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full border-dashed border-2 h-20 flex-col gap-1 hover:border-primary/50 hover:bg-primary/5"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-5 w-5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      Clique para enviar um arquivo
                    </span>
                  </Button>
                )}
              </div>

              <Button
                type="submit"
                className="w-full shadow-lg shadow-primary/20"
                disabled={loading}
              >
                <Send className="mr-2 h-4 w-4" />
                {loading ? "Salvando..." : "Salvar Contato"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AddContact;
