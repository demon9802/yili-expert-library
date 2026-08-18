package com.yili.expert.resource.service;

import com.yili.expert.resource.dto.*;
import java.util.List;

public interface AuthService {
    Object signUp(SignUpRequest request);

    /** 注册输入框实时校验：账号是否已被占用（仅返回存在与否，不泄露其他信息） */
    boolean checkAccountExists(String email);
    Object login(LoginRequest request);
    void logout();
    void resetPassword(String email);
    void changePassword(ChangePasswordRequest request);
    boolean reauthenticate(String password);
    void saveSecurityQuestions(SecurityQuestionRequest request);
    Object getSecurityQuestionTexts(Long userId);
    Object verifySecurityAnswers(SecurityVerifyRequest request);
    void changePasswordAfterSecurityVerification(Long userId, String newPassword);
    List<UserDTO> fetchUserList();
    void adminResetUserPassword(AdminResetPasswordRequest request);
    UserDTO createSubAdmin(CreateSubAdminRequest request);
    void deleteUser(Long userId);
    void updateUserPermissions(UpdateUserPermissionsRequest request);
    boolean checkForcePasswordChange();
    void clearForcePasswordChange();
}
