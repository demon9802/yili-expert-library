package com.yili.expert.resource.controller;

import com.yili.expert.resource.common.ApiResponse;
import com.yili.expert.resource.dto.*;
import com.yili.expert.resource.service.AuthService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 认证 Controller
 * 对应原项目: signInWithEmail, signInWithPassword, signUpWithPassword, signOut,
 * resetPassword, changePassword, reauthenticate, 密保问题, 用户管理
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    @Autowired
    private AuthService authService;

    @PostMapping("/signup")
    public ApiResponse<Object> signUp(@RequestBody SignUpRequest request) {
        return ApiResponse.success(authService.signUp(request));
    }

    @PostMapping("/login")
    public ApiResponse<Object> login(@RequestBody LoginRequest request) {
        return ApiResponse.success(authService.login(request));
    }

    @PostMapping("/logout")
    public ApiResponse<Void> logout() {
        authService.logout();
        return ApiResponse.success();
    }

    @PostMapping("/reset-password")
    public ApiResponse<Void> resetPassword(@RequestParam String email) {
        authService.resetPassword(email);
        return ApiResponse.success();
    }

    @PutMapping("/change-password")
    public ApiResponse<Void> changePassword(@RequestBody ChangePasswordRequest request) {
        authService.changePassword(request);
        return ApiResponse.success();
    }

    @PostMapping("/reauthenticate")
    public ApiResponse<Boolean> reauthenticate(@RequestParam String password) {
        return ApiResponse.success(authService.reauthenticate(password));
    }

    @GetMapping("/force-password-change")
    public ApiResponse<Boolean> checkForcePasswordChange() {
        return ApiResponse.success(authService.checkForcePasswordChange());
    }

    @DeleteMapping("/force-password-change")
    public ApiResponse<Void> clearForcePasswordChange() {
        authService.clearForcePasswordChange();
        return ApiResponse.success();
    }

    // ===== 密保问题 =====

    @PutMapping("/security/questions")
    public ApiResponse<Void> saveSecurityQuestions(@RequestBody SecurityQuestionRequest request) {
        authService.saveSecurityQuestions(request);
        return ApiResponse.success();
    }

    @GetMapping("/security/questions/{userId}")
    public ApiResponse<Object> getSecurityQuestionTexts(@PathVariable Long userId) {
        return ApiResponse.success(authService.getSecurityQuestionTexts(userId));
    }

    @PostMapping("/security/verify")
    public ApiResponse<Object> verifySecurityAnswers(@RequestBody SecurityVerifyRequest request) {
        return ApiResponse.success(authService.verifySecurityAnswers(request));
    }

    @PostMapping("/security/reset-password")
    public ApiResponse<Void> changePasswordAfterSecurityVerification(
            @RequestParam Long userId, @RequestParam String newPassword) {
        authService.changePasswordAfterSecurityVerification(userId, newPassword);
        return ApiResponse.success();
    }

    // ===== 用户管理（管理员） =====

    @GetMapping("/users")
    public ApiResponse<List<UserDTO>> fetchUserList() {
        return ApiResponse.success(authService.fetchUserList());
    }

    @PostMapping("/users/reset-password")
    public ApiResponse<Void> adminResetUserPassword(@RequestBody AdminResetPasswordRequest request) {
        authService.adminResetUserPassword(request);
        return ApiResponse.success();
    }

    @PostMapping("/users/sub-admin")
    public ApiResponse<UserDTO> createSubAdmin(@RequestBody CreateSubAdminRequest request) {
        return ApiResponse.success(authService.createSubAdmin(request));
    }

    @DeleteMapping("/users/{userId}")
    public ApiResponse<Void> deleteUser(@PathVariable Long userId) {
        authService.deleteUser(userId);
        return ApiResponse.success();
    }

    @PutMapping("/users/permissions")
    public ApiResponse<Void> updateUserPermissions(@RequestBody UpdateUserPermissionsRequest request) {
        authService.updateUserPermissions(request);
        return ApiResponse.success();
    }
}
