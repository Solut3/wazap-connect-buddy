import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs, deleteDoc, doc, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, MessageCircle, Trash2, Phone, FileText, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface Contact {
  id: string;
  name: string;
  phone: string;
  description: string;
  documentUrl?: string;
  documentName?: string;
  createdAt: string;
}

const Index = () => {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchContacts = async () => {
    try {
      const q = query(collection(db, "contacts"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Contact[];
      setContacts(data);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao carregar contatos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, []);

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, "contacts", id));
      setContacts((prev) => prev.filter((c) => c.id !== id));
      toast.success("Contato removido!");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao remover contato.");
    }
  };

  const openWhatsApp = (phone: string, documentUrl?: string) => {
    const cleaned = phone.replace(/\D/g, "");
    const message = documentUrl
      ? encodeURIComponent(`Olá! Segue o documento: ${documentUrl}`)
      : "";
    const url = message
      ? `https://wa.me/${cleaned}?text=${message}`
      : `https://wa.me/${cleaned}`;
    window.open(url, "_blank");
  };

  const filtered = contacts.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search)
  );

  return (
    <div className="min-h-screen bg-background p-4 pb-24">
      <div className="mx-auto max-w-md">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-extrabold text-foreground tracking-tight">
                Zap Connect
              </h1>
              <p className="text-sm text-muted-foreground">
                {contacts.length} contato{contacts.length !== 1 ? "s" : ""}
              </p>
            </div>
            <Button
              onClick={() => navigate("/add")}
              size="icon"
              className="h-12 w-12 rounded-full shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all"
            >
              <Plus className="h-5 w-5" />
            </Button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar contato..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-card border-border"
            />
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="h-11 w-11 rounded-full bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-24 rounded bg-muted" />
                    <div className="h-3 w-32 rounded bg-muted" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center py-12">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <MessageCircle className="h-8 w-8 text-primary" />
              </div>
              <p className="text-muted-foreground font-medium">
                {search ? "Nenhum resultado" : "Nenhum contato ainda"}
              </p>
              {!search && (
                <Button
                  variant="link"
                  onClick={() => navigate("/add")}
                  className="text-primary mt-1"
                >
                  Adicionar primeiro contato
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map((contact) => (
              <Card
                key={contact.id}
                className="group hover:border-primary/30 transition-colors"
              >
                <CardContent className="flex items-center gap-3 p-4">
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary font-bold text-lg cursor-pointer hover:bg-primary/25 transition-colors"
                    onClick={() =>
                      openWhatsApp(contact.phone, contact.documentUrl)
                    }
                  >
                    {contact.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground truncate">
                      {contact.name}
                    </p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {contact.phone}
                    </p>
                    {contact.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {contact.description}
                      </p>
                    )}
                    {contact.documentName && (
                      <p className="text-xs text-primary flex items-center gap-1 mt-0.5">
                        <FileText className="h-3 w-3" />
                        {contact.documentName}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        openWhatsApp(contact.phone, contact.documentUrl)
                      }
                      className="text-primary hover:text-primary hover:bg-primary/10"
                    >
                      <MessageCircle className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(contact.id)}
                      className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
