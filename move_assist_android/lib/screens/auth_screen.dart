import 'package:flutter/material.dart';
import '../services/auth_service.dart';
import '../services/session_service.dart';
import 'home_screen.dart';

class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key});

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  bool _isLogin = true;
  bool _loading = false;

  // Login controllers
  final _loginIdentifier = TextEditingController();
  final _loginPassword = TextEditingController();

  // Register controllers
  final _regName = TextEditingController();
  final _regEmail = TextEditingController();
  final _regPassword = TextEditingController();
  final _regPhone = TextEditingController();

  @override
  void dispose() {
    _loginIdentifier.dispose();
    _loginPassword.dispose();
    _regName.dispose();
    _regEmail.dispose();
    _regPassword.dispose();
    _regPhone.dispose();
    super.dispose();
  }

  Future<void> _doLogin() async {
    if (_loginIdentifier.text.trim().isEmpty || _loginPassword.text.isEmpty) {
      _showError('Please fill in all fields');
      return;
    }
    setState(() => _loading = true);
    try {
      final result = await AuthService.login(
        emailOrPhone: _loginIdentifier.text.trim(),
        password: _loginPassword.text,
      );
      if (!mounted) return;
      _navigateToHome(result);
    } catch (e) {
      if (!mounted) return;
      _showError(e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _doRegister() async {
    if (_regName.text.trim().isEmpty ||
        _regEmail.text.trim().isEmpty ||
        _regPassword.text.isEmpty) {
      _showError('Please fill in all required fields');
      return;
    }
    setState(() => _loading = true);
    try {
      final result = await AuthService.register(
        name: _regName.text.trim(),
        email: _regEmail.text.trim(),
        password: _regPassword.text,
        phone: _regPhone.text.trim(),
      );
      if (!mounted) return;
      _navigateToHome(result);
    } catch (e) {
      if (!mounted) return;
      _showError(e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _navigateToHome(Map<String, dynamic> result) async {
    final user = result['user'] as Map<String, dynamic>;
    final token = result['token'] as String;
    await SessionService.save(token: token, user: user);
    if (!mounted) return;
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(
        builder: (_) => HomeScreen(user: user, token: token),
      ),
    );
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: const Color(0xFFef4444),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        margin: const EdgeInsets.all(16),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFf6f7f8),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 40),
              // Logo + Title header
              const Center(
                child: Text('📦', style: TextStyle(fontSize: 48)),
              ),
              const SizedBox(height: 10),
              const Center(
                child: Text(
                  'MoveAssist',
                  style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF0f1729),
                    letterSpacing: -0.3,
                  ),
                ),
              ),
              const SizedBox(height: 4),
              const Center(
                child: Text(
                  'Home shifting, made structured',
                  style: TextStyle(
                    fontSize: 13,
                    color: Color(0xFF64748b),
                  ),
                ),
              ),
              const SizedBox(height: 28),
              // Tab switcher
              _buildTabSwitcher(),
              const SizedBox(height: 24),
              // Form
              AnimatedSwitcher(
                duration: const Duration(milliseconds: 200),
                child: _isLogin
                    ? _buildLoginForm(key: const ValueKey('login'))
                    : _buildRegisterForm(key: const ValueKey('register')),
              ),
              const SizedBox(height: 20),
              const Center(
                child: Text(
                  'localhost:3000',
                  style: TextStyle(fontSize: 11, color: Color(0xFF94a3b8)),
                ),
              ),
              const SizedBox(height: 40),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTabSwitcher() {
    return Container(
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: const Color(0xFFf6f7f8),
        border: Border.all(color: const Color(0xFFe2e8f0)),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: [
          Expanded(child: _buildTab('Sign In', isActive: _isLogin, onTap: () => setState(() => _isLogin = true))),
          Expanded(child: _buildTab('Register', isActive: !_isLogin, onTap: () => setState(() => _isLogin = false))),
        ],
      ),
    );
  }

  Widget _buildTab(String label, {required bool isActive, required VoidCallback onTap}) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color: isActive ? const Color(0xFF2563eb) : Colors.transparent,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Text(
          label,
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w700,
            color: isActive ? Colors.white : const Color(0xFF64748b),
          ),
        ),
      ),
    );
  }

  Widget _buildLoginForm({Key? key}) {
    return Column(
      key: key,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _buildField(
          label: 'EMAIL OR PHONE NUMBER',
          controller: _loginIdentifier,
          placeholder: 'you@email.com or +91-9999999999',
          keyboardType: TextInputType.emailAddress,
          autofillHints: const [AutofillHints.username, AutofillHints.email],
        ),
        _buildField(
          label: 'PASSWORD',
          controller: _loginPassword,
          placeholder: '••••••••',
          obscure: true,
          autofillHints: const [AutofillHints.password],
        ),
        const SizedBox(height: 4),
        _buildPrimaryButton(label: 'Sign In →', onTap: _doLogin),
      ],
    );
  }

  Widget _buildRegisterForm({Key? key}) {
    return Column(
      key: key,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _buildField(
          label: 'FULL NAME',
          controller: _regName,
          placeholder: 'Amit Sharma',
          keyboardType: TextInputType.name,
          autofillHints: const [AutofillHints.name],
        ),
        _buildField(
          label: 'EMAIL ADDRESS',
          controller: _regEmail,
          placeholder: 'you@email.com',
          keyboardType: TextInputType.emailAddress,
          autofillHints: const [AutofillHints.email],
        ),
        _buildField(
          label: 'PASSWORD',
          controller: _regPassword,
          placeholder: 'Min 8 characters',
          obscure: true,
          autofillHints: const [AutofillHints.newPassword],
        ),
        _buildField(
          label: 'PHONE (OPTIONAL)',
          controller: _regPhone,
          placeholder: '+91-9999999999',
          keyboardType: TextInputType.phone,
          autofillHints: const [AutofillHints.telephoneNumber],
        ),
        _buildPrimaryButton(label: 'Create Account →', onTap: _doRegister),
      ],
    );
  }

  Widget _buildField({
    required String label,
    required TextEditingController controller,
    required String placeholder,
    bool obscure = false,
    TextInputType? keyboardType,
    List<String>? autofillHints,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: Color(0xFF64748b),
              letterSpacing: 0.5,
            ),
          ),
          const SizedBox(height: 6),
          TextField(
            controller: controller,
            obscureText: obscure,
            keyboardType: keyboardType,
            autofillHints: autofillHints,
            style: const TextStyle(fontSize: 15, color: Color(0xFF0f1729)),
            decoration: InputDecoration(
              hintText: placeholder,
              hintStyle: const TextStyle(color: Color(0xFF94a3b8), fontSize: 15),
              filled: true,
              fillColor: const Color(0xFFf8fafc),
              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide: const BorderSide(color: Color(0xFFe2e8f0)),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide: const BorderSide(color: Color(0xFFe2e8f0)),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide: const BorderSide(color: Color(0xFF2563eb), width: 1.5),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPrimaryButton({required String label, required VoidCallback onTap}) {
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton(
        onPressed: _loading ? null : onTap,
        style: ElevatedButton.styleFrom(
          backgroundColor: const Color(0xFF2563eb),
          foregroundColor: Colors.white,
          disabledBackgroundColor: const Color(0xFF2563eb),
          padding: const EdgeInsets.symmetric(vertical: 14),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          elevation: 0,
        ),
        child: _loading
            ? const SizedBox(
                height: 20,
                width: 20,
                child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
              )
            : Text(
                label,
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.3,
                ),
              ),
      ),
    );
  }
}