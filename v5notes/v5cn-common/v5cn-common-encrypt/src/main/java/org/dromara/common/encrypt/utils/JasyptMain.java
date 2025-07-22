package org.dromara.common.encrypt.utils;

import org.jasypt.encryption.pbe.StandardPBEStringEncryptor;

public class JasyptMain {
    public static void main(String[] args) {
        StandardPBEStringEncryptor encryptor = new StandardPBEStringEncryptor();
//        encryptor.setAlgorithm("PBEWITHHMACSHA512ANDAES_256");
        encryptor.setPassword("YOUR_SECRET_KEY"); // 设置加密密钥
        String encryptedPassword = encryptor.encrypt("your_db_password");
        System.out.println("Encrypted Password: " + encryptedPassword);
        System.out.println("Decrypted Password: " + encryptor.decrypt(encryptedPassword));
    }
}
