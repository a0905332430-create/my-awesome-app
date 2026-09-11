import AsyncStorage from "@react-native-async-storage/async-storage";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Haptics from "expo-haptics";
import * as Speech from "expo-speech";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";

type WordCard = {
  id: string;
  word: string;
  translation: string;
};

type ExampleSentence = {
  sentence: string;
  translation: string;
};

type WordDeck = {
  id: string;
  title: string;
  cards: WordCard[];
  createdAt: string;
};

type Screen = "home" | "edit" | "quiz" | "complete";

type QuizState = {
  deckId: string;
  total: number;
  activeCardIds: string[];
  currentCardId: string;
};

const STORAGE_KEY = "vocab-loop.decks.v1";

const STARTER_DECKS: WordDeck[] = [
  {
    id: "starter-travel",
    title: "旅行英語 · 範例",
    createdAt: "2026-09-11T00:00:00.000Z",
    cards: [
      { id: "travel-1", word: "itinerary", translation: "行程；旅行計畫" },
      { id: "travel-2", word: "reservation", translation: "預訂；預約" },
      { id: "travel-3", word: "luggage", translation: "行李" },
      { id: "travel-4", word: "departure", translation: "出發；離境" },
      { id: "travel-5", word: "currency", translation: "貨幣" },
      { id: "travel-6", word: "souvenir", translation: "紀念品" },
    ],
  },
];

function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function pickNextCard(activeCardIds: string[], previousId?: string) {
  const candidates =
    activeCardIds.length > 1 && previousId
      ? activeCardIds.filter((id) => id !== previousId)
      : activeCardIds;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function tapHaptic() {
  if (Platform.OS !== "web") {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

function successHaptic() {
  if (Platform.OS !== "web") {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }
}

export default function HomeScreen() {
  const [decks, setDecks] = useState<WordDeck[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [screen, setScreen] = useState<Screen>("home");
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [newWord, setNewWord] = useState("");
  const [newTranslation, setNewTranslation] = useState("");
  const [quiz, setQuiz] = useState<QuizState | null>(null);
  const [answerVisible, setAnswerVisible] = useState(false);
  const [example, setExample] = useState<ExampleSentence | null>(null);
  const [exampleLoading, setExampleLoading] = useState(false);
  const [exampleError, setExampleError] = useState(false);
  const [lastExampleSentence, setLastExampleSentence] = useState("");
  const exampleMutation = trpc.examples.generate.useMutation();

  useEffect(() => {
    let mounted = true;

    async function loadDecks() {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        const parsed = saved ? (JSON.parse(saved) as WordDeck[]) : STARTER_DECKS;
        if (mounted) {
          setDecks(Array.isArray(parsed) ? parsed : STARTER_DECKS);
        }
      } catch {
        if (mounted) {
          setDecks(STARTER_DECKS);
        }
      } finally {
        if (mounted) {
          setHydrated(true);
        }
      }
    }

    void loadDecks();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (hydrated) {
      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(decks));
    }
  }, [decks, hydrated]);

  const selectedDeck = useMemo(
    () => decks.find((deck) => deck.id === selectedDeckId) ?? null,
    [decks, selectedDeckId],
  );

  const activeQuizDeck = useMemo(
    () => decks.find((deck) => deck.id === quiz?.deckId) ?? null,
    [decks, quiz?.deckId],
  );

  const currentQuizCard = useMemo(
    () => activeQuizDeck?.cards.find((card) => card.id === quiz?.currentCardId) ?? null,
    [activeQuizDeck, quiz?.currentCardId],
  );

  function updateDeck(deckId: string, updater: (deck: WordDeck) => WordDeck) {
    setDecks((currentDecks) =>
      currentDecks.map((deck) => (deck.id === deckId ? updater(deck) : deck)),
    );
  }

  function createDeck() {
    tapHaptic();
    const deck: WordDeck = {
      id: makeId(),
      title: "新的單字集",
      cards: [],
      createdAt: new Date().toISOString(),
    };
    setDecks((currentDecks) => [deck, ...currentDecks]);
    setSelectedDeckId(deck.id);
    setNewWord("");
    setNewTranslation("");
    setScreen("edit");
  }

  function openDeck(deckId: string) {
    tapHaptic();
    setSelectedDeckId(deckId);
    setNewWord("");
    setNewTranslation("");
    setScreen("edit");
  }

  function addCard() {
    if (!selectedDeck) return;
    const word = newWord.trim();
    const translation = newTranslation.trim();

    if (!word || !translation) {
      Alert.alert("還差一點", "請同時輸入英文單字與對應翻譯。 ");
      return;
    }

    tapHaptic();
    const card: WordCard = { id: makeId(), word, translation };
    updateDeck(selectedDeck.id, (deck) => ({ ...deck, cards: [...deck.cards, card] }));
    setNewWord("");
    setNewTranslation("");
  }

  function removeCard(cardId: string) {
    if (!selectedDeck) return;
    Alert.alert("移除這張單字卡？", "這個動作不會影響同一組的其他單字。", [
      { text: "取消", style: "cancel" },
      {
        text: "移除",
        style: "destructive",
        onPress: () => {
          updateDeck(selectedDeck.id, (deck) => ({
            ...deck,
            cards: deck.cards.filter((card) => card.id !== cardId),
          }));
        },
      },
    ]);
  }

  function removeDeck() {
    if (!selectedDeck) return;
    Alert.alert("刪除整個單字集？", "所有單字卡都會一併移除。", [
      { text: "取消", style: "cancel" },
      {
        text: "刪除",
        style: "destructive",
        onPress: () => {
          setDecks((currentDecks) => currentDecks.filter((deck) => deck.id !== selectedDeck.id));
          setSelectedDeckId(null);
          setScreen("home");
        },
      },
    ]);
  }

  function startQuiz(deck: WordDeck) {
    if (deck.cards.length === 0) {
      Alert.alert("先加入單字卡", "這個單字集目前還沒有可測驗的內容。 ");
      return;
    }

    tapHaptic();
    const activeCardIds = deck.cards.map((card) => card.id);
    setQuiz({
      deckId: deck.id,
      total: activeCardIds.length,
      activeCardIds,
      currentCardId: pickNextCard(activeCardIds),
    });
    setAnswerVisible(false);
    setExample(null);
    setExampleError(false);
    setLastExampleSentence("");
    setScreen("quiz");
  }

  function speakWord(word: string) {
    void (async () => {
      try {
        if (await Speech.isSpeakingAsync()) {
          await Speech.stop();
        }
        Speech.speak(word, { language: "en-US", rate: 0.82, pitch: 1 });
      } catch {
        Speech.speak(word, { language: "en-US" });
      }
    })();
  }

  function revealCard() {
    tapHaptic();
    const nextVisible = !answerVisible;
    const previousSentence = lastExampleSentence;
    setAnswerVisible(nextVisible);
    setExample(null);
    setExampleError(false);

    if (nextVisible && currentQuizCard) {
      setExampleLoading(true);
      exampleMutation.mutate(
        {
          word: currentQuizCard.word,
          translation: currentQuizCard.translation,
          avoidSentence: previousSentence || undefined,
        },
        {
          onSuccess: (result) => {
            setExample(result);
            setLastExampleSentence(result.sentence);
            setExampleLoading(false);
          },
          onError: () => {
            setExampleError(true);
            setExampleLoading(false);
          },
        },
      );
    } else {
      setExampleLoading(false);
    }
  }

  function classifyCard(known: boolean) {
    if (!quiz || !currentQuizCard) return;
    tapHaptic();

    if (!known) {
      setQuiz((currentQuiz) => {
        if (!currentQuiz) return currentQuiz;
        return {
          ...currentQuiz,
          currentCardId: pickNextCard(currentQuiz.activeCardIds, currentQuiz.currentCardId),
        };
      });
      setAnswerVisible(false);
      setExample(null);
      setExampleError(false);
      setExampleLoading(false);
      setLastExampleSentence("");
      return;
    }

    const remainingCardIds = quiz.activeCardIds.filter((id) => id !== currentQuizCard.id);
    if (remainingCardIds.length === 0) {
      successHaptic();
      setScreen("complete");
      return;
    }

    setQuiz({
      ...quiz,
      activeCardIds: remainingCardIds,
      currentCardId: pickNextCard(remainingCardIds, currentQuizCard.id),
    });
    setAnswerVisible(false);
    setExample(null);
    setExampleError(false);
    setExampleLoading(false);
    setLastExampleSentence("");
  }

  function leaveQuiz() {
    setQuiz(null);
    setAnswerVisible(false);
    setExample(null);
    setExampleError(false);
    setExampleLoading(false);
    setLastExampleSentence("");
    setScreen(selectedDeck ? "edit" : "home");
  }

  if (!hydrated) {
    return (
      <ScreenContainer edges={["top", "bottom", "left", "right"]} style={styles.screen}>
        <View style={styles.loadingScreen}>
          <View style={styles.loadingMark}>
            <Text style={styles.loadingMarkText}>V</Text>
          </View>
          <Text style={styles.loadingTitle}>Vocab Loop</Text>
          <Text style={styles.loadingSubtitle}>正在整理你的單字卡</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (screen === "edit" && selectedDeck) {
    return (
      <DeckEditor
        deck={selectedDeck}
        newWord={newWord}
        newTranslation={newTranslation}
        onChangeTitle={(title) => updateDeck(selectedDeck.id, (deck) => ({ ...deck, title }))}
        onChangeWord={setNewWord}
        onChangeTranslation={setNewTranslation}
        onAddCard={addCard}
        onRemoveCard={removeCard}
        onBack={() => setScreen("home")}
        onDeleteDeck={removeDeck}
        onStartQuiz={() => startQuiz(selectedDeck)}
      />
    );
  }

  if (screen === "quiz" && quiz && activeQuizDeck && currentQuizCard) {
    return (
      <QuizScreen
        deck={activeQuizDeck}
        quiz={quiz}
        card={currentQuizCard}
        answerVisible={answerVisible}
        example={example}
        exampleLoading={exampleLoading}
        exampleError={exampleError}
        onReveal={revealCard}
        onSpeak={speakWord}
        onClassify={classifyCard}
        onClose={leaveQuiz}
      />
    );
  }

  if (screen === "complete" && quiz && activeQuizDeck) {
    return (
      <CompletionScreen
        deck={activeQuizDeck}
        total={quiz.total}
        onAgain={() => startQuiz(activeQuizDeck)}
        onBack={() => {
          setQuiz(null);
          setSelectedDeckId(activeQuizDeck.id);
          setScreen("edit");
        }}
      />
    );
  }

  return <DeckHome decks={decks} onOpenDeck={openDeck} onCreateDeck={createDeck} onStartQuiz={startQuiz} />;
}

function DeckHome({
  decks,
  onOpenDeck,
  onCreateDeck,
  onStartQuiz,
}: {
  decks: WordDeck[];
  onOpenDeck: (deckId: string) => void;
  onCreateDeck: () => void;
  onStartQuiz: (deck: WordDeck) => void;
}) {
  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} style={styles.screen}>
      <FlatList
        data={decks}
        keyExtractor={(deck) => deck.id}
        contentContainerStyle={styles.homeList}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.homeHeader}>
            <View style={styles.brandRow}>
              <View style={styles.brandMark}>
                <Text style={styles.brandMarkText}>V</Text>
              </View>
              <Text style={styles.brandName}>VOCAB LOOP</Text>
            </View>
            <Text style={styles.homeTitle}>把記不住的，{`\n`}留在下一張。</Text>
            <Text style={styles.homeDescription}>
              建立自己的英文單字集，翻卡後快速判斷。會的離開，不會的繼續回來。
            </Text>
            <View style={styles.sectionHeading}>
              <Text style={styles.sectionTitle}>我的單字集</Text>
              <Text style={styles.sectionHint}>{decks.length} 組</Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <MaterialIcons name="auto-stories" size={25} color="#156D72" />
            </View>
            <Text style={styles.emptyTitle}>從第一組單字開始</Text>
            <Text style={styles.emptyText}>輸入英文與你的翻譯，讓每張卡都貼近你的學習方式。</Text>
          </View>
        }
        renderItem={({ item: deck }) => (
          <Pressable
            onPress={() => onOpenDeck(deck.id)}
            style={({ pressed }) => [styles.deckCard, pressed && styles.pressed]}
            accessibilityLabel={`開啟 ${deck.title}`}
          >
            <View style={styles.deckTopRow}>
              <View style={styles.deckIconWrap}>
                <MaterialIcons name="style" size={22} color="#156D72" />
              </View>
              <View style={styles.deckMenuIcon}>
                <MaterialIcons name="more-horiz" size={22} color="#6B7E7A" />
              </View>
            </View>
            <Text style={styles.deckTitle} numberOfLines={1}>{deck.title || "未命名單字集"}</Text>
            <Text style={styles.deckMeta}>{deck.cards.length} 張單字卡</Text>
            <View style={styles.deckFooter}>
              <Text style={styles.deckAction}>管理單字</Text>
              <Pressable
                onPress={(event) => {
                  event.stopPropagation();
                  onStartQuiz(deck);
                }}
                style={({ pressed }) => [styles.smallPracticeButton, pressed && styles.pressed]}
                accessibilityLabel={`開始 ${deck.title} 的測驗`}
              >
                <Text style={styles.smallPracticeButtonText}>開始測驗</Text>
                <MaterialIcons name="arrow-forward" size={16} color="#FFFFFF" />
              </Pressable>
            </View>
          </Pressable>
        )}
        ListFooterComponent={
          <Pressable onPress={onCreateDeck} style={({ pressed }) => [styles.createDeckButton, pressed && styles.pressed]}>
            <View style={styles.createDeckIcon}>
              <MaterialIcons name="add" size={22} color="#156D72" />
            </View>
            <Text style={styles.createDeckText}>建立新的單字集</Text>
          </Pressable>
        }
      />
    </ScreenContainer>
  );
}

function DeckEditor({
  deck,
  newWord,
  newTranslation,
  onChangeTitle,
  onChangeWord,
  onChangeTranslation,
  onAddCard,
  onRemoveCard,
  onBack,
  onDeleteDeck,
  onStartQuiz,
}: {
  deck: WordDeck;
  newWord: string;
  newTranslation: string;
  onChangeTitle: (value: string) => void;
  onChangeWord: (value: string) => void;
  onChangeTranslation: (value: string) => void;
  onAddCard: () => void;
  onRemoveCard: (cardId: string) => void;
  onBack: () => void;
  onDeleteDeck: () => void;
  onStartQuiz: () => void;
}) {
  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} style={styles.screen}>
      <FlatList
        data={deck.cards}
        keyExtractor={(card) => card.id}
        contentContainerStyle={styles.editorList}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            <View style={styles.editorNav}>
              <Pressable onPress={onBack} style={({ pressed }) => [styles.circleButton, pressed && styles.pressed]} accessibilityLabel="返回單字集列表">
                <MaterialIcons name="arrow-back" size={22} color="#173937" />
              </Pressable>
              <Text style={styles.editorNavTitle}>編輯單字集</Text>
              <Pressable onPress={onDeleteDeck} style={({ pressed }) => [styles.circleButton, pressed && styles.pressed]} accessibilityLabel="刪除單字集">
                <MaterialIcons name="delete-outline" size={21} color="#C4544D" />
              </Pressable>
            </View>

            <Text style={styles.fieldLabel}>單字集名稱</Text>
            <TextInput
              value={deck.title}
              onChangeText={onChangeTitle}
              style={styles.deckTitleInput}
              placeholder="例如：TOEIC 常見動詞"
              placeholderTextColor="#A7B5B2"
              returnKeyType="done"
            />

            <View style={styles.editorStatCard}>
              <View style={styles.editorStatIcon}>
                <MaterialIcons name="layers" size={23} color="#156D72" />
              </View>
              <View style={styles.editorStatTextWrap}>
                <Text style={styles.editorStatTitle}>這組目前有 {deck.cards.length} 張卡</Text>
                <Text style={styles.editorStatHint}>全部標記為「我會了」才會完成一輪測驗。</Text>
              </View>
            </View>

            <View style={styles.addCardPanel}>
              <View style={styles.addCardHeader}>
                <View>
                  <Text style={styles.addCardTitle}>新增一張單字卡</Text>
                  <Text style={styles.addCardSubtitle}>英文在前，寫下你最熟悉的翻譯。</Text>
                </View>
                <View style={styles.addCardBadge}>
                  <Text style={styles.addCardBadgeText}>NEW</Text>
                </View>
              </View>
              <TextInput
                value={newWord}
                onChangeText={onChangeWord}
                style={styles.textInput}
                placeholder="English word"
                placeholderTextColor="#9AA9A6"
                autoCapitalize="none"
                returnKeyType="next"
              />
              <TextInput
                value={newTranslation}
                onChangeText={onChangeTranslation}
                style={styles.textInput}
                placeholder="中文翻譯或你的提示"
                placeholderTextColor="#9AA9A6"
                returnKeyType="done"
                onSubmitEditing={onAddCard}
              />
              <Pressable onPress={onAddCard} style={({ pressed }) => [styles.addCardButton, pressed && styles.pressed]}>
                <MaterialIcons name="add" size={19} color="#FFFFFF" />
                <Text style={styles.addCardButtonText}>加入單字卡</Text>
              </Pressable>
            </View>

            <View style={styles.cardListHeader}>
              <Text style={styles.cardListTitle}>單字卡清單</Text>
              <Text style={styles.cardListCount}>{deck.cards.length} 張</Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyWordsCard}>
            <MaterialIcons name="edit-note" size={29} color="#76A9A7" />
            <Text style={styles.emptyWordsTitle}>還沒有單字卡</Text>
            <Text style={styles.emptyWordsText}>從上方輸入第一個英文單字與翻譯。</Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <View style={styles.wordRow}>
            <Text style={styles.wordIndex}>{String(index + 1).padStart(2, "0")}</Text>
            <View style={styles.wordCopy}>
              <Text style={styles.wordText}>{item.word}</Text>
              <Text style={styles.translationText}>{item.translation}</Text>
            </View>
            <Pressable
              onPress={() => onRemoveCard(item.id)}
              style={({ pressed }) => [styles.removeCardButton, pressed && styles.pressed]}
              accessibilityLabel={`移除 ${item.word}`}
            >
              <MaterialIcons name="close" size={19} color="#8A9895" />
            </Pressable>
          </View>
        )}
        ListFooterComponent={
          <Pressable
            onPress={onStartQuiz}
            style={({ pressed }) => [styles.startQuizButton, deck.cards.length === 0 && styles.disabledButton, pressed && deck.cards.length > 0 && styles.pressed]}
            disabled={deck.cards.length === 0}
          >
            <View style={styles.startQuizButtonCopy}>
              <Text style={styles.startQuizEyebrow}>START A LOOP</Text>
              <Text style={styles.startQuizLabel}>開始這組測驗</Text>
            </View>
            <View style={styles.startQuizIcon}>
              <MaterialIcons name="arrow-forward" size={22} color="#156D72" />
            </View>
          </Pressable>
        }
      />
    </ScreenContainer>
  );
}

function QuizScreen({
  deck,
  quiz,
  card,
  answerVisible,
  example,
  exampleLoading,
  exampleError,
  onReveal,
  onSpeak,
  onClassify,
  onClose,
}: {
  deck: WordDeck;
  quiz: QuizState;
  card: WordCard;
  answerVisible: boolean;
  example: ExampleSentence | null;
  exampleLoading: boolean;
  exampleError: boolean;
  onReveal: () => void;
  onSpeak: (word: string) => void;
  onClassify: (known: boolean) => void;
  onClose: () => void;
}) {
  const mastered = quiz.total - quiz.activeCardIds.length;

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} style={styles.quizScreen}>
      <View style={styles.quizNav}>
        <Pressable onPress={onClose} style={({ pressed }) => [styles.circleButton, styles.quizCloseButton, pressed && styles.pressed]} accessibilityLabel="離開測驗">
          <MaterialIcons name="close" size={22} color="#DDEEEB" />
        </Pressable>
        <View style={styles.quizNavCopy}>
          <Text style={styles.quizNavTitle} numberOfLines={1}>{deck.title || "未命名單字集"}</Text>
          <Text style={styles.quizNavSubtitle}>隨機循環測驗</Text>
        </View>
        <View style={styles.quizCounter}>
          <Text style={styles.quizCounterNumber}>{quiz.activeCardIds.length}</Text>
          <Text style={styles.quizCounterLabel}>張待確認</Text>
        </View>
      </View>

      <View style={styles.quizProgressSummary}>
        <Text style={styles.quizProgressText}>已掌握 {mastered} / {quiz.total}</Text>
        <Text style={styles.quizProgressGuide}>不會的卡會再出現</Text>
      </View>

      <View style={styles.quizContent}>
        <Pressable
          onPress={onReveal}
          style={({ pressed }) => [styles.flashcard, answerVisible && styles.flashcardRevealed, pressed && styles.pressed]}
          accessibilityLabel={answerVisible ? "隱藏翻譯" : "顯示翻譯"}
        >
          <View style={styles.cardSurfaceTop}>
            <View style={styles.languagePill}>
              <Text style={styles.languagePillText}>ENGLISH</Text>
            </View>
            <View style={styles.cardTopActions}>
              <Pressable
                onPress={(event) => {
                  event.stopPropagation();
                  onSpeak(card.word);
                }}
                style={({ pressed }) => [styles.speakButton, pressed && styles.pressed]}
                accessibilityLabel={`朗讀 ${card.word}`}
              >
                <MaterialIcons name="volume-up" size={20} color="#156D72" />
              </Pressable>
              <MaterialIcons name={answerVisible ? "visibility-off" : "visibility"} size={20} color="#76A9A7" />
            </View>
          </View>
          <Text style={styles.quizWord}>{card.word}</Text>
          <View style={styles.cardDivider} />
          {answerVisible ? (
            <View style={styles.answerArea}>
              <Text style={styles.answerLabel}>你的翻譯</Text>
              <Text style={styles.answerText}>{card.translation}</Text>
              <View style={styles.exampleBlock}>
                <View style={styles.exampleHeader}>
                  <Text style={styles.exampleLabel}>AI 例句</Text>
                  <Text style={styles.exampleBadge}>NEW</Text>
                </View>
                {exampleLoading ? (
                  <View style={styles.exampleLoadingRow}>
                    <View style={styles.exampleLoadingDot} />
                    <Text style={styles.exampleLoadingText}>正在為這張卡想一個新例句…</Text>
                  </View>
                ) : exampleError ? (
                  <Text style={styles.exampleErrorText}>例句載入失敗，但你仍可以繼續作答。</Text>
                ) : example ? (
                  <>
                    <Text style={styles.exampleSentence}>{example.sentence}</Text>
                    <Text style={styles.exampleTranslation}>{example.translation}</Text>
                  </>
                ) : null}
              </View>
              <Text style={styles.tapHint}>再點一下可收起翻譯</Text>
            </View>
          ) : (
            <View style={styles.hiddenAnswerArea}>
              <Text style={styles.hiddenAnswerDots}>•••</Text>
              <Text style={styles.tapHint}>點一下翻面查看翻譯</Text>
            </View>
          )}
        </Pressable>

        <Text style={styles.classifyPrompt}>
          {answerVisible ? "看完翻譯後，這個字你記得嗎？" : "先點選卡片，查看你的翻譯"}
        </Text>
      </View>

      <View style={styles.classifyActions}>
        <Pressable
          onPress={() => onClassify(false)}
          disabled={!answerVisible}
          style={({ pressed }) => [styles.classifyButton, styles.notYetButton, !answerVisible && styles.disabledButton, pressed && answerVisible && styles.pressed]}
        >
          <MaterialIcons name="refresh" size={21} color="#B64E4A" />
          <View>
            <Text style={styles.classifyButtonLabel}>還不會</Text>
            <Text style={styles.classifyButtonCaption}>留下來再碰一次</Text>
          </View>
        </Pressable>
        <Pressable
          onPress={() => onClassify(true)}
          disabled={!answerVisible}
          style={({ pressed }) => [styles.classifyButton, styles.knowButton, !answerVisible && styles.disabledButton, pressed && answerVisible && styles.pressed]}
        >
          <MaterialIcons name="check-circle" size={21} color="#FFFFFF" />
          <View>
            <Text style={styles.knowButtonLabel}>我會了</Text>
            <Text style={styles.knowButtonCaption}>這輪不會再出現</Text>
          </View>
        </Pressable>
      </View>
    </ScreenContainer>
  );
}

function CompletionScreen({
  deck,
  total,
  onAgain,
  onBack,
}: {
  deck: WordDeck;
  total: number;
  onAgain: () => void;
  onBack: () => void;
}) {
  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} style={styles.completionScreen}>
      <View style={styles.completionContent}>
        <View style={styles.completionOrbitOuter}>
          <View style={styles.completionOrbitMiddle}>
            <View style={styles.completionMark}>
              <MaterialIcons name="check" size={47} color="#FFFFFF" />
            </View>
          </View>
        </View>
        <Text style={styles.completionEyebrow}>LOOP COMPLETE</Text>
        <Text style={styles.completionTitle}>這一輪，全會了。</Text>
        <Text style={styles.completionText}>
          你已把「{deck.title || "這組單字"}」的 {total} 張卡都標記為會了。做得很好。
        </Text>
        <View style={styles.completionRule} />
        <Text style={styles.completionSmallText}>下次可以再開一輪，確認記憶還在。</Text>
      </View>
      <View style={styles.completionActions}>
        <Pressable onPress={onAgain} style={({ pressed }) => [styles.completionPrimaryButton, pressed && styles.pressed]}>
          <Text style={styles.completionPrimaryText}>再測一次</Text>
          <MaterialIcons name="refresh" size={19} color="#FFFFFF" />
        </Pressable>
        <Pressable onPress={onBack} style={({ pressed }) => [styles.completionSecondaryButton, pressed && styles.pressed]}>
          <Text style={styles.completionSecondaryText}>回到單字集</Text>
        </Pressable>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: "#FBF8F1",
  },
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FBF8F1",
  },
  loadingMark: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: "#156D72",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  loadingMarkText: {
    color: "#FFFFFF",
    fontSize: 25,
    fontWeight: "800",
  },
  loadingTitle: {
    color: "#173937",
    fontSize: 23,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  loadingSubtitle: {
    color: "#71817E",
    fontSize: 14,
    marginTop: 6,
  },
  homeList: {
    paddingHorizontal: 20,
    paddingBottom: 18,
  },
  homeHeader: {
    paddingTop: 20,
    paddingBottom: 24,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginBottom: 31,
  },
  brandMark: {
    width: 29,
    height: 29,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#156D72",
  },
  brandMarkText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  brandName: {
    color: "#173937",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  homeTitle: {
    color: "#173937",
    fontSize: 34,
    lineHeight: 42,
    letterSpacing: -1.2,
    fontWeight: "800",
  },
  homeDescription: {
    color: "#637673",
    fontSize: 15,
    lineHeight: 23,
    marginTop: 14,
    maxWidth: 330,
  },
  sectionHeading: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 34,
  },
  sectionTitle: {
    color: "#173937",
    fontSize: 18,
    fontWeight: "800",
  },
  sectionHint: {
    color: "#7A918E",
    fontSize: 13,
    fontWeight: "700",
  },
  emptyCard: {
    borderRadius: 22,
    backgroundColor: "#F0F6F3",
    borderWidth: 1,
    borderColor: "#D6E6E1",
    padding: 24,
    alignItems: "center",
  },
  emptyIcon: {
    width: 49,
    height: 49,
    borderRadius: 17,
    backgroundColor: "#DDF0EB",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 13,
  },
  emptyTitle: {
    color: "#173937",
    fontSize: 16,
    fontWeight: "800",
  },
  emptyText: {
    color: "#71817E",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 7,
    textAlign: "center",
  },
  deckCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E4E9E1",
    shadowColor: "#365D56",
    shadowOpacity: 0.08,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  deckTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  deckIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#E9F5F1",
    alignItems: "center",
    justifyContent: "center",
  },
  deckMenuIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "#F8F8F4",
    alignItems: "center",
    justifyContent: "center",
  },
  deckTitle: {
    color: "#173937",
    fontSize: 20,
    fontWeight: "800",
    marginTop: 20,
  },
  deckMeta: {
    color: "#71817E",
    fontSize: 14,
    marginTop: 5,
  },
  deckFooter: {
    marginTop: 19,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: "#EEF1EB",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  deckAction: {
    color: "#53726D",
    fontSize: 13,
    fontWeight: "700",
  },
  smallPracticeButton: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: "#156D72",
    paddingHorizontal: 13,
    borderRadius: 13,
  },
  smallPracticeButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  createDeckButton: {
    minHeight: 64,
    marginTop: 5,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#B8D6CE",
    borderStyle: "dashed",
    backgroundColor: "#F5FAF7",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  createDeckIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#DDF0EB",
  },
  createDeckText: {
    color: "#156D72",
    fontSize: 15,
    fontWeight: "800",
  },
  editorList: {
    paddingHorizontal: 20,
    paddingBottom: 26,
  },
  editorNav: {
    paddingTop: 16,
    paddingBottom: 25,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  editorNavTitle: {
    color: "#173937",
    fontSize: 16,
    fontWeight: "800",
  },
  circleButton: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E9E4",
    alignItems: "center",
    justifyContent: "center",
  },
  fieldLabel: {
    color: "#55716C",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.3,
    marginBottom: 8,
  },
  deckTitleInput: {
    color: "#173937",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDE6DF",
    fontSize: 23,
    fontWeight: "800",
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderRadius: 17,
  },
  editorStatCard: {
    marginTop: 15,
    flexDirection: "row",
    gap: 12,
    padding: 14,
    borderRadius: 17,
    backgroundColor: "#E9F5F1",
  },
  editorStatIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  editorStatTextWrap: {
    flex: 1,
    justifyContent: "center",
  },
  editorStatTitle: {
    color: "#1B4948",
    fontSize: 14,
    fontWeight: "800",
  },
  editorStatHint: {
    color: "#5E807B",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 2,
  },
  addCardPanel: {
    marginTop: 24,
    borderRadius: 22,
    padding: 17,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E9E4",
  },
  addCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  addCardTitle: {
    color: "#173937",
    fontSize: 17,
    fontWeight: "800",
  },
  addCardSubtitle: {
    color: "#748581",
    fontSize: 12,
    marginTop: 4,
  },
  addCardBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "#FBE7D7",
  },
  addCardBadgeText: {
    color: "#C76739",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.7,
  },
  textInput: {
    height: 50,
    backgroundColor: "#F8FAF7",
    borderWidth: 1,
    borderColor: "#E2EAE4",
    borderRadius: 13,
    color: "#173937",
    fontSize: 15,
    paddingHorizontal: 13,
    marginBottom: 9,
  },
  addCardButton: {
    marginTop: 3,
    height: 47,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 13,
    backgroundColor: "#156D72",
  },
  addCardButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  cardListHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 27,
    marginBottom: 10,
  },
  cardListTitle: {
    color: "#173937",
    fontSize: 17,
    fontWeight: "800",
  },
  cardListCount: {
    color: "#7A918E",
    fontSize: 13,
    fontWeight: "700",
  },
  emptyWordsCard: {
    padding: 25,
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#CFE0DA",
    alignItems: "center",
    backgroundColor: "#F6FAF7",
  },
  emptyWordsTitle: {
    color: "#42635E",
    fontSize: 15,
    fontWeight: "800",
    marginTop: 7,
  },
  emptyWordsText: {
    color: "#7A918E",
    fontSize: 13,
    marginTop: 3,
  },
  wordRow: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#E5EBE5",
  },
  wordIndex: {
    width: 25,
    color: "#9BAAA6",
    fontSize: 11,
    fontWeight: "800",
  },
  wordCopy: {
    flex: 1,
  },
  wordText: {
    color: "#173937",
    fontSize: 16,
    fontWeight: "800",
  },
  translationText: {
    color: "#6B807B",
    fontSize: 13,
    marginTop: 3,
  },
  removeCardButton: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: "#F7F8F4",
    alignItems: "center",
    justifyContent: "center",
  },
  startQuizButton: {
    minHeight: 74,
    marginTop: 24,
    paddingLeft: 20,
    paddingRight: 12,
    borderRadius: 22,
    backgroundColor: "#173937",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  startQuizButtonCopy: {
    gap: 2,
  },
  startQuizEyebrow: {
    color: "#9ED1C9",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },
  startQuizLabel: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
  },
  startQuizIcon: {
    width: 49,
    height: 49,
    borderRadius: 16,
    backgroundColor: "#DDF0EB",
    alignItems: "center",
    justifyContent: "center",
  },
  quizScreen: {
    backgroundColor: "#173937",
  },
  quizNav: {
    paddingHorizontal: 20,
    paddingTop: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  quizCloseButton: {
    backgroundColor: "#244C4A",
    borderColor: "#3E6662",
  },
  quizNavCopy: {
    flex: 1,
  },
  quizNavTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  quizNavSubtitle: {
    color: "#9DC9C2",
    fontSize: 11,
    marginTop: 2,
  },
  quizCounter: {
    minWidth: 52,
    borderRadius: 13,
    paddingHorizontal: 8,
    paddingVertical: 7,
    backgroundColor: "#244C4A",
    alignItems: "center",
  },
  quizCounterNumber: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
  },
  quizCounterLabel: {
    color: "#9DC9C2",
    fontSize: 9,
    fontWeight: "700",
  },
  quizProgressSummary: {
    marginHorizontal: 20,
    marginTop: 21,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#3B615D",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  quizProgressText: {
    color: "#DFF2ED",
    fontSize: 13,
    fontWeight: "800",
  },
  quizProgressGuide: {
    color: "#9DC9C2",
    fontSize: 12,
  },
  quizContent: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 28,
  },
  flashcard: {
    minHeight: 340,
    padding: 24,
    justifyContent: "space-between",
    borderRadius: 28,
    backgroundColor: "#FBF8F1",
    borderWidth: 2,
    borderColor: "#FBF8F1",
    shadowColor: "#071C1B",
    shadowOpacity: 0.28,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 5,
  },
  flashcardRevealed: {
    borderColor: "#A7D5CD",
  },
  cardSurfaceTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardTopActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  speakButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#DDF0EB",
    alignItems: "center",
    justifyContent: "center",
  },
  languagePill: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#E5F2EE",
  },
  languagePillText: {
    color: "#23747A",
    fontSize: 10,
    letterSpacing: 0.8,
    fontWeight: "900",
  },
  quizWord: {
    color: "#173937",
    fontSize: 35,
    lineHeight: 43,
    letterSpacing: -1.1,
    fontWeight: "800",
    marginTop: 28,
  },
  cardDivider: {
    height: 1,
    backgroundColor: "#DCE6DF",
    marginTop: 25,
  },
  hiddenAnswerArea: {
    minHeight: 102,
    justifyContent: "flex-end",
  },
  hiddenAnswerDots: {
    color: "#A8BAB4",
    fontSize: 27,
    letterSpacing: 4,
    lineHeight: 31,
  },
  answerArea: {
    minHeight: 102,
    justifyContent: "flex-end",
  },
  answerLabel: {
    color: "#77928D",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  answerText: {
    color: "#195B5E",
    fontSize: 24,
    lineHeight: 32,
    fontWeight: "800",
    marginTop: 5,
  },
  exampleBlock: {
    marginTop: 14,
    padding: 12,
    borderRadius: 15,
    backgroundColor: "#EEF6F1",
    borderWidth: 1,
    borderColor: "#D5E8DF",
  },
  exampleHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  exampleLabel: {
    color: "#337D78",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  exampleBadge: {
    color: "#C76739",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.6,
  },
  exampleSentence: {
    color: "#234B49",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800",
    marginTop: 7,
  },
  exampleTranslation: {
    color: "#6D8580",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 3,
  },
  exampleLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 8,
  },
  exampleLoadingDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#4A9B91",
  },
  exampleLoadingText: {
    color: "#6D8580",
    fontSize: 12,
  },
  exampleErrorText: {
    color: "#B64E4A",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
  },
  tapHint: {
    color: "#849793",
    fontSize: 12,
    marginTop: 8,
  },
  classifyPrompt: {
    color: "#B7D6D0",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 20,
  },
  classifyActions: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    flexDirection: "row",
    gap: 10,
  },
  classifyButton: {
    flex: 1,
    minHeight: 73,
    borderRadius: 19,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  notYetButton: {
    backgroundColor: "#F9E6DF",
    borderWidth: 1,
    borderColor: "#F0C5B8",
  },
  knowButton: {
    backgroundColor: "#19807B",
  },
  classifyButtonLabel: {
    color: "#A84844",
    fontSize: 15,
    fontWeight: "900",
  },
  classifyButtonCaption: {
    color: "#B86B5E",
    fontSize: 10,
    marginTop: 2,
  },
  knowButtonLabel: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },
  knowButtonCaption: {
    color: "#C9E9E3",
    fontSize: 10,
    marginTop: 2,
  },
  completionScreen: {
    backgroundColor: "#F1F8F4",
  },
  completionContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 34,
    paddingTop: 30,
  },
  completionOrbitOuter: {
    width: 178,
    height: 178,
    borderRadius: 89,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#DCEFE7",
  },
  completionOrbitMiddle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#BFE2D6",
  },
  completionMark: {
    width: 99,
    height: 99,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#19807B",
  },
  completionEyebrow: {
    color: "#218078",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.6,
    marginTop: 33,
  },
  completionTitle: {
    color: "#173937",
    fontSize: 31,
    lineHeight: 39,
    letterSpacing: -0.8,
    fontWeight: "900",
    marginTop: 8,
  },
  completionText: {
    color: "#607B75",
    fontSize: 15,
    lineHeight: 24,
    textAlign: "center",
    marginTop: 12,
  },
  completionRule: {
    width: 38,
    height: 3,
    borderRadius: 3,
    backgroundColor: "#9DCCC0",
    marginTop: 22,
  },
  completionSmallText: {
    color: "#7C938E",
    fontSize: 12,
    marginTop: 14,
  },
  completionActions: {
    paddingHorizontal: 20,
    paddingBottom: 18,
    gap: 10,
  },
  completionPrimaryButton: {
    minHeight: 57,
    borderRadius: 18,
    backgroundColor: "#156D72",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  completionPrimaryText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
  },
  completionSecondaryButton: {
    minHeight: 53,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DCE7E1",
  },
  completionSecondaryText: {
    color: "#416560",
    fontSize: 15,
    fontWeight: "800",
  },
  disabledButton: {
    opacity: 0.42,
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.98 }],
  },
});
