import React, { useState } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Linking, Platform } from 'react-native';
import { GlobalFontStyleSheet } from '@/constants/Font';

const faqs = [
    ...(Platform.OS === 'android' ? [{
        question: "How does the 30-day guarantee work?",
        answer: "The guarantee is designed to let you experience the benefits of a Pro plan whilst knowing that you can always get a refund if you're not fully satisfied.\n\nOnly 5% of learners have asked for this, but we understand that everyone is different when it comes to learning. If you find that Langua isn't the best fit for you, you'll simply need to email or message us and we'll promptly send a full refund. We promise we don't make this difficult!"
    }] : []),
    ...(Platform.OS === 'ios' ? [
        {
            question: "How does the free trial work?",
            answer: "You'll get full access to all premium features, and can cancel anytime in Settings > My Subscription with just a few clicks. If you don't cancel, your subscription will start automatically after the trial ends. Due to our running costs, trials are limited to one per user - so dive in and make the most of it! Please note that we do require card details to prevent trial abuse, as well as ensure you get uninterrupted access after your trial."
        },
        {
        question: "What is your refund policy?",
        answer: "If you subscribe to Langua via the Apple App Store, it won't qualify for our 30-day guarantee because purchases made via Apple are subject to Apple's terms and their refund policies, which vary depending on your country. To request a refund for a purchase from the Apple App Store, you'll need to do this via Apple."
        }
    ] : []),
    {
        question: "Is it easy to cancel?",
        answer: "Absolutely! Cancelling your Langua subscription is a straightforward process that can be completed in just a few clicks. Simply go to Settings > Subscription within your account, and follow the prompts to cancel. We understand the frustration of dealing with companies that make it difficult to cancel, and we're committed to being different."
    },
    {
        question: "What are the differences between the Communicate & Unlimited plans?",
        answer: 
            "Your Langua Communicate plan has the following limits:\n\n- **Regular Chat Modes:** Up to 75 messages each day (takes the average learner 45 mins)\n- **Call Mode:** Up to 30 minutes of call time daily.\n- **Other Tools** (feedback, summaries, flashcards, stories, podcasts): Currently unlimited.\n\nShould you reach your daily allowance in either chat or call mode, it will refresh the next day. For continuous, unrestricted access, you can upgrade to Langua Unlimited."
    },
    {
        question: "How does Langua work & what features are available?",
        answer: [
            "We would recommend you ",
            {
                text: "watch our explainer video",
                url: "https://support.languatalk.com/article/145-how-does-langua-work-explainer-video"
            },
            " to learn how Langua works. To view all features, scroll up to the plans above and select 'Click to discover key features'."
        ]
    },
    {
        question: "How does Langua differ from other apps & software?",
        answer: "With so many language learning apps available, it can be tricky to choose the right one.\n\nDuolingo, the most well known app, offers a gamified experience with simple exercises and multiple-choice questions. Whilst it is helpful for beginners who need to build their vocabulary, there's a common criticism: you can use it for years and still not become fluent.\n\nAs a child, you learnt your native language by exploring, primarily through listening, speaking, and reading. While you'll have changed a lot since then, it still makes sense to learn your target language in the same fun & exploratory way. Langua makes this possible.\n\n99% of learners sign up to practice speaking and get instant feedback using Langua's conversational AI. Reviews from learners often mention that they like the:\n\n1) Human-like voices with native accents (most apps sound more robotic)\n\n2) Wide range of carefully designed conversation modes (role plays, debates, vocabulary and grammar practice, and more)\n\n3) Hands-free options for seamless conversation\n\n4) Corrections and explanations for mistakes, including the option to get a detailed feedback report following a conversation.\n\n5) Instant translation and ability to save vocabulary.\n\n6) Integration with spaced repetition flashcards. You can see a full list of features by clicking the link under each plan."
    },
    {
        question: "What can I do with the free version?",
        answer: Platform.OS === 'android' ?
            "With the free version, you can quickly test the conversational AI. Due to the high costs of running AI models, we have to limit free usage. Once you've hit the limit, you can try a Pro plan, knowing that there's a 30-day moneyback guarantee in case you change your mind.\n\nThe free plan does allow you to instantly generate interactive transcripts for podcasts, videos and article" :
            "With the free version, you can quickly test the conversational AI. Due to the high costs of running AI models, we have to limit free usage. Once you've hit the limit, you can try a Pro plan.\n\nThe free plan does allow you to instantly generate interactive transcripts for podcasts, videos and articles. This is limited to one transcript per day, but you can also see transcripts that are already in our library. You'll be able to translate words in one click."
    },
    {
        question: "Can I learn multiple languages with one subscription?",
        answer: "Yes, your subscription includes all available languages. You can switch fairly easily within the app and website."
    },
    {
        question: "Which languages are available?",
        answer: "Langua officially offers 19 languages, listed below. Many of these are available in more than one dialect (see Settings). On the web version, the first 9 languages in the list below also have a library of podcasts and videos. The last 10 do not, but you can always search for your favourite podcasts, and import videos and texts for these languages. Some other languages that use the Latin alphabet may work with the conversational AI, but we have not tested them yet. We'll be launching Asian languages very soon.\n\n• English\n• Spanish\n• French\n• German\n• Italian\n• Portuguese\n• Dutch\n• Swedish\n• Romanian\n• Russian\n• Greek\n• Turkish\n• Hindi\n• Danish\n• Norwegian\n• Finnish\n• Polish\n• Czech\n• Croatian"
    },
    {
        question: "Should I choose a monthly or annual subscription?",
        answer: Platform.OS === 'android' ?
            "Learning a language takes time and perseverance, so if you want to pay less per month, the annual plan is a good choice. Of course, we also have the 30-day moneyback guarantee, so you can always try annual and change your mind later. The monthly plan is still great value, and is a good option if you don't have the funds to pay for an annual subscription." :
            "Learning a language takes time and perseverance, so if you want to pay less per month, the annual plan is a good choice. The monthly plan is still great value, and is a good option if you don't have the funds to pay for an annual subscription."
    },
    {
        question: "Do I need to invest a lot of time?",
        answer: "In short, it's entirely up to you. Flexibility is one of the key benefits of learning with Langua. You can practice whenever you have a moment free, without having to plan sessions in advance. You can learn for a few minutes a day, or immerse yourself for hours.\n\nResearch has shown that the key to successfully learning a language is consistency. So we encourage you to do at least 5 minutes every day if possible."
    }
];

const FAQs = () => {
    const [faqVisible, setFaqVisible] = useState<Number | null>(null); // State to manage which FAQ is visible

    const renderAnswer = (answer: string | Array<string | { text: string, url: string }>) => {
        if (typeof answer === 'string') {
            return <Text className="p-4 text-base text-gray-500 dark:text-white">{answer}</Text>;
        }

        return (
            <Text className="p-4 text-base text-gray-500 dark:text-white">
                {answer.map((part, index) => {
                    if (typeof part === 'string') {
                        return part;
                    }
                    return (
                        <Text
                            key={index}
                            className="dark:text-blue-300 text-blue-500 underline"
                            onPress={() => Linking.openURL(part.url)}
                        >
                            {part.text}
                        </Text>
                    );
                })}
            </Text>
        );
    }

    return (
        <View className="w-full mt-6">
            <Text style={GlobalFontStyleSheet.textXl} className='mb-5 text-center font-bold text-gray-500 dark:text-white'>FAQs</Text>
            {faqs.map((faq, index) => (
                <View key={index} className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-800 rounded mb-4 overflow-hidden">
                    <TouchableOpacity onPress={() => setFaqVisible(faqVisible === index ? null : index)}>
                        <Text className="p-4 text-lg font-bold text-gray-500 dark:text-white">{faq.question}</Text>
                    </TouchableOpacity>
                    {faqVisible === index && renderAnswer(faq.answer)}
                </View>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        margin: 20,
    },
    faqCard: {
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 5,
        marginBottom: 15,
        overflow: 'hidden',
    },
    faqQuestion: {
        backgroundColor: '#f7f7f7',
        padding: 15,
        fontSize: 18,
        fontWeight: 'bold',
        color: '#007BFF', // Bootstrap primary color
    },
    faqAnswer: {
        padding: 15,
        fontSize: 16,
    },
});

export default FAQs;
