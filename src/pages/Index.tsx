import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs, deleteDoc, doc, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, MessageCircle, Trash2, Phone, FileText, Search, Zap } from "lucide-react";
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
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center glow-sm">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight gradient-text">
                  Zap Connect
                </h1>
                <p className="text-xs text-muted-foreground font-medium">
                  {contacts.length} contato{contacts.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <Button
              onClick={() => navigate("/add")}
              size="icon"
              className="h-12 w-12 rounded-xl glow-md hover-lift"
            >
              <Plus className="h-5 w-5" />
            </Button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar contato..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-11 glass-card rounded-xl text-sm placeholder:text-muted-foreground/60"
            />
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="glass-card animate-pulse rounded-xl">
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="h-12 w-12 rounded-xl bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-28 rounded-lg bg-muted" />
                    <div className="h-3 w-36 rounded-lg bg-muted" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="glass-card border-dashed rounded-xl">
            <CardContent className="flex flex-col items-center py-16">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 glow-sm">
                <MessageCircle className="h-8 w-8 text-primary" />
              </div>
              <p className="text-muted-foreground font-medium text-sm">
                {search ? "Nenhum resultado encontrado" : "Nenhum contato ainda"}
              </p>
              {!search && (
                <Button
                  variant="link"
                  onClick={() => navigate("/add")}
                  className="text-primary mt-2 text-sm"
                >
                  Adicionar primeiro contato →
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2.5">
            {filtered.map((contact) => (
              <Card
                key={contact.id}
                className="glass-card rounded-xl group hover:border-primary/20 hover-lift"
              >
                <CardContent className="flex items-center gap-3.5 p-4">
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-lg cursor-pointer hover:bg-primary/20 transition-colors"
                    onClick={() =>
                      openWhatsApp(contact.phone, contact.documentUrl)
                    }
                  >
                    {contact.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground truncate text-[15px]">
                      {contact.name}
                    </p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                      <Phone className="h-3 w-3" />
                      {contact.phone}
                    </p>
                    {contact.description && (
                      <p className="text-xs text-muted-foreground/70 mt-1 truncate">
                        {contact.description}
                      </p>
                    )}
                    {contact.documentName && (
                      <p className="text-xs text-primary/80 flex items-center gap-1 mt-1">
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
                      className="h-9 w-9 rounded-lg text-primary hover:text-primary hover:bg-primary/10"
                    >
                      <MessageCircle className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(contact.id)}
                      className="h-9 w-9 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
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
