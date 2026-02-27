import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../services/api';

export const LoginScreen = ({ navigation }: any) => {
  const [account, setAccount] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'account' | 'code'>('account');
  const [loading, setLoading] = useState(false);

  const getCleanAccount = () => {
    const trimmed = account.trim();
    if (trimmed.includes('@')) return trimmed;
    return trimmed.replace(/[^\d+]/g, '');
  };

  const handleGetCode = async () => {
    const cleanAccount = getCleanAccount();
    if (!cleanAccount) {
      Alert.alert('Erro', 'Por favor, digite seu e-mail ou telefone.');
      return;
    }
    setLoading(true);
    try {
      await api.getVerificationCode(cleanAccount);
      setStep('code');
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.message || 'Falha ao enviar código.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!code) {
      Alert.alert('Erro', 'Digite o código de verificação.');
      return;
    }
    const cleanAccount = getCleanAccount();
    setLoading(true);
    try {
      const data = await api.login(cleanAccount, code);
      if (data && data.token) {
        // Zustand já atualiza e o App.tsx vai navegar para o Dashboard
      }
    } catch (err: any) {
      Alert.alert('Erro', 'Código inválido ou expirado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.inner}>
        <View style={styles.logoContainer}>
          <View style={styles.iconBox}>
             <Text style={styles.iconText}>S</Text>
          </View>
          <Text style={styles.logoText}>Climatic Pro</Text>
          <Text style={styles.subText}>Monitoramento de Ativos</Text>
        </View>

        <View style={styles.form}>
          {step === 'account' ? (
            <>
              <TextInput
                style={styles.input}
                placeholder="E-mail ou Telefone (ex: +55...)"
                value={account}
                onChangeText={setAccount}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholderTextColor="#94a3b8"
              />
              <TouchableOpacity style={styles.button} onPress={handleGetCode} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Solicitar Código de Acesso</Text>}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TextInput
                style={styles.input}
                placeholder="Código de 6 dígitos"
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                maxLength={6}
                placeholderTextColor="#94a3b8"
                textAlign="center"
                style={[styles.input, { letterSpacing: 8, fontSize: 24, fontWeight: 'bold' }]}
              />
              <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Entrar no Sistema</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.backButton} onPress={() => setStep('account')}>
                <Text style={styles.backButtonText}>Voltar e alterar conta</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <View style={styles.footer}>
            <Text style={styles.footerText}>Climatic Pro © 2024 • Termos e Privacidade</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  inner: { flex: 1, justifyContent: 'space-between', paddingHorizontal: 30, paddingVertical: 40 },
  logoContainer: { alignItems: 'center', marginTop: 60 },
  iconBox: {
    width: 64,
    height: 64,
    backgroundColor: '#197fe6',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#197fe6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  iconText: { color: '#fff', fontSize: 32, fontWeight: 'bold' },
  logoText: { fontSize: 32, fontWeight: 'bold', color: '#0f172a' },
  subText: { fontSize: 14, color: '#64748b', marginTop: 5 },
  form: { width: '100%', flex: 1, justifyContent: 'center' },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 15,
    borderRadius: 12,
    fontSize: 16,
    marginBottom: 20,
    color: '#0f172a',
  },
  button: {
    backgroundColor: '#197fe6',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#197fe6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  backButton: { marginTop: 20, alignItems: 'center' },
  backButtonText: { color: '#197fe6', fontSize: 14, fontWeight: '500' },
  footer: { alignItems: 'center' },
  footerText: { color: '#94a3b8', fontSize: 11 },
});
