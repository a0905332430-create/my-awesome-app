import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";

type AdminUser = {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  loginMethod: string | null;
  role: "user" | "admin";
  createdAt: string | Date;
  lastSignedIn: string | Date;
  decks: unknown[];
  learningStats: { masteredWords?: string[] } | null;
};

function dateLabel(value: string | Date) {
  return new Date(value).toLocaleString("zh-TW", { dateStyle: "medium", timeStyle: "short" });
}

export default function AdminScreen() {
  const router = useRouter();
  const me = trpc.auth.me.useQuery();
  const users = trpc.admin.users.list.useQuery(undefined, { enabled: me.data?.role === "admin" });
  const updateUser = trpc.admin.users.update.useMutation({ onSuccess: () => void users.refetch() });
  const removeUser = trpc.admin.users.remove.useMutation({ onSuccess: () => void users.refetch() });
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  if (me.isLoading) return <ScreenContainer style={styles.center}><Text style={styles.muted}>正在確認管理員權限…</Text></ScreenContainer>;
  if (me.data?.role !== "admin") {
    return <ScreenContainer style={styles.center}><MaterialIcons name="lock" size={36} color="#C4544D" /><Text style={styles.title}>無權限</Text><Text style={styles.muted}>只有管理員可以查看這個頁面。</Text><Pressable onPress={() => router.back()} style={styles.primary}><Text style={styles.primaryText}>返回 App</Text></Pressable></ScreenContainer>;
  }

  const beginEdit = (user: AdminUser) => {
    setEditing(user);
    setName(user.name ?? "");
    setEmail(user.email ?? "");
  };
  const saveEdit = () => {
    if (!editing) return;
    updateUser.mutate({ openId: editing.openId, name: name.trim() || null, email: email.trim() || null });
    setEditing(null);
  };
  const confirmDelete = (user: AdminUser) => {
    Alert.alert("刪除使用者資料", `確定要刪除 ${user.email || user.name || user.openId} 嗎？這會一併刪除他的單字集與學習統計，且無法復原。`, [
      { text: "取消", style: "cancel" },
      { text: "刪除", style: "destructive", onPress: () => removeUser.mutate({ openId: user.openId }) },
    ]);
  };

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} style={styles.screen}>
      <View style={styles.header}><Pressable onPress={() => router.back()} style={styles.iconButton}><MaterialIcons name="arrow-back" size={22} color="#173937" /></Pressable><View><Text style={styles.eyebrow}>VOCAB LOOP ADMIN</Text><Text style={styles.heading}>使用者管理</Text></View><Text style={styles.count}>{users.data?.length ?? 0} 位</Text></View>
      <Text style={styles.description}>查看、修改帳戶資料，或刪除使用者及其雲端學習資料。</Text>
      {users.isLoading ? <Text style={styles.muted}>正在載入使用者…</Text> : <FlatList data={users.data as AdminUser[] | undefined} keyExtractor={(item) => item.openId} contentContainerStyle={styles.list} renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={styles.cardTop}><View style={styles.avatar}><Text style={styles.avatarText}>{(item.name || item.email || "?").slice(0, 1).toUpperCase()}</Text></View><View style={styles.identity}><Text style={styles.userName}>{item.name || "未命名使用者"}</Text><Text style={styles.email}>{item.email || "沒有 Email"}</Text><Text style={styles.meta}>{item.role === "admin" ? "管理員" : "一般使用者"} · {item.loginMethod || "未知登入方式"}</Text></View></View>
          <View style={styles.stats}><Text style={styles.statText}>{item.decks?.length ?? 0} 組單字集</Text><Text style={styles.statText}>{item.learningStats?.masteredWords?.length ?? 0} 個已掌握</Text><Text style={styles.statText}>登入 {dateLabel(item.lastSignedIn)}</Text></View>
          <View style={styles.actions}><Pressable onPress={() => beginEdit(item)} style={styles.secondary}><MaterialIcons name="edit" size={17} color="#156D72" /><Text style={styles.secondaryText}>修改</Text></Pressable><Pressable onPress={() => confirmDelete(item)} style={styles.danger}><MaterialIcons name="delete-outline" size={17} color="#C4544D" /><Text style={styles.dangerText}>刪除</Text></Pressable></View>
        </View>
      )} ListEmptyComponent={<Text style={styles.muted}>目前沒有使用者資料。</Text>} />}
      {editing && <View style={styles.editor}><View style={styles.editorHeader}><Text style={styles.editorTitle}>修改使用者</Text><Pressable onPress={() => setEditing(null)}><MaterialIcons name="close" size={22} color="#637673" /></Pressable></View><TextInput value={name} onChangeText={setName} placeholder="姓名" placeholderTextColor="#9AA9A5" style={styles.input} /><TextInput value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor="#9AA9A5" autoCapitalize="none" keyboardType="email-address" style={styles.input} /><Pressable onPress={saveEdit} style={styles.primary}><Text style={styles.primaryText}>{updateUser.isPending ? "儲存中…" : "儲存修改"}</Text></Pressable></View>}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: "#FBF8F1", paddingHorizontal: 20 },
  center: { backgroundColor: "#FBF8F1", alignItems: "center", justifyContent: "center", padding: 24 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 12, paddingBottom: 14 },
  iconButton: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#E8F1EE" },
  eyebrow: { color: "#7A918E", fontSize: 10, fontWeight: "900", letterSpacing: 1.3 },
  heading: { color: "#173937", fontSize: 26, fontWeight: "800", marginTop: 2 },
  count: { marginLeft: "auto", color: "#156D72", fontWeight: "800" },
  description: { color: "#637673", lineHeight: 21, marginBottom: 12 },
  list: { gap: 12, paddingBottom: 24 },
  card: { backgroundColor: "#FFFFFF", borderRadius: 18, padding: 16, borderWidth: 1, borderColor: "#E4EDE9" },
  cardTop: { flexDirection: "row", gap: 12 },
  avatar: { width: 42, height: 42, borderRadius: 14, backgroundColor: "#DCEDEA", alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#156D72", fontSize: 18, fontWeight: "900" },
  identity: { flex: 1 },
  userName: { color: "#173937", fontSize: 16, fontWeight: "800" },
  email: { color: "#637673", fontSize: 12, marginTop: 2 },
  meta: { color: "#8A9A95", fontSize: 11, marginTop: 4 },
  stats: { flexDirection: "row", gap: 10, flexWrap: "wrap", borderTopWidth: 1, borderTopColor: "#EEF3F0", marginTop: 13, paddingTop: 11 },
  statText: { color: "#637673", fontSize: 11 },
  actions: { flexDirection: "row", gap: 9, marginTop: 14 },
  secondary: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, backgroundColor: "#E8F1EE" },
  secondaryText: { color: "#156D72", fontWeight: "800", fontSize: 12 },
  danger: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, backgroundColor: "#FBE9E5" },
  dangerText: { color: "#C4544D", fontWeight: "800", fontSize: 12 },
  editor: { position: "absolute", left: 12, right: 12, bottom: 14, backgroundColor: "#FFFFFF", borderRadius: 20, padding: 17, borderWidth: 1, borderColor: "#DCE8E3", shadowColor: "#173937", shadowOpacity: 0.12, shadowRadius: 16, elevation: 5 },
  editorHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  editorTitle: { color: "#173937", fontSize: 17, fontWeight: "800" },
  input: { height: 46, borderWidth: 1, borderColor: "#D8E4DF", borderRadius: 12, paddingHorizontal: 13, color: "#173937", marginBottom: 9, backgroundColor: "#FBFDFC" },
  primary: { backgroundColor: "#173937", borderRadius: 13, minHeight: 46, alignItems: "center", justifyContent: "center", paddingHorizontal: 18, marginTop: 13 },
  primaryText: { color: "#FFFFFF", fontWeight: "800" },
  title: { color: "#173937", fontSize: 24, fontWeight: "800", marginTop: 12 },
  muted: { color: "#7A918E", marginTop: 8, textAlign: "center" },
});

export const unstable_settings = { initialRouteName: "admin" };
