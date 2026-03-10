import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs, deleteDoc, doc, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, MessageCircle, Trash2, Phone } from "lucide-react";
import { toast } from "sonner";

interface Contact {
  id: string;
  name: string;
  phone: string;
  description: string;
  createdAt: string;
}

const Index = () => {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

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
      toast.error("Erro ao carregar contatos. Verifique o Firebase.");
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

  const openWhatsApp = (phone: string) => {
    const cleaned = phone.replace(/\D/g, "");
    window.open(`https://wa.me/${cleaned}`, "_blank");
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="mx-auto max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Contatos WhatsApp</h1>
            <p className="text-sm text-muted-foreground">
              {contacts.length} contato{contacts.length !== 1 ? "s" : ""}
            </p>
          </div>
          <Button onClick={() => navigate("/add")} size="icon" className="h-12 w-12 rounded-full">
            <Plus className="h-5 w-5" />
          </Button>
        </div>

        {loading ? (
          <p className="text-center text-muted-foreground">Carregando...</p>
        ) : contacts.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center py-10">
              <MessageCircle className="mb-3 h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground">Nenhum contato ainda</p>
              <Button variant="link" onClick={() => navigate("/add")}>
                Adicionar primeiro contato
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {contacts.map((contact) => (
              <Card key={contact.id}>
                <CardContent className="flex items-center gap-3 p-4">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold cursor-pointer"
                    onClick={() => openWhatsApp(contact.phone)}
                  >
                    {contact.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground truncate">{contact.name}</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {contact.phone}
                    </p>
                    {contact.description && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {contact.description}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openWhatsApp(contact.phone)}
                      className="text-green-600 hover:text-green-700"
                    >
                      <MessageCircle className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(contact.id)}
                      className="text-destructive hover:text-destructive"
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
